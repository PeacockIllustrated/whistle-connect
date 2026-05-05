'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { getStripe } from '@/lib/stripe/server'
import { calculateChargeAmount, STRIPE_CONFIG } from '@/lib/stripe/config'
import { validate, topUpSchema, withdrawSchema } from '@/lib/validation'
import { checkTopUpRateLimit, checkWithdrawRateLimit } from '@/lib/rate-limit'
import { isEnabled } from '@/lib/feature-flags'
import type { Wallet, WalletTransaction } from '@/lib/types'

export async function getWallet(): Promise<{ data?: Wallet; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

    if (error) {
        return { error: error.message }
    }

    return { data: data ?? undefined }
}

export async function getTransactions(
    limit = 20,
    offset = 0
): Promise<{ data?: WalletTransaction[]; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (!wallet) {
        return { data: [] }
    }

    const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (error) {
        return { error: error.message }
    }

    return { data: data ?? [] }
}

export async function createTopUpSession(amountPounds: number): Promise<{
    url?: string
    error?: string
}> {
    if (!isEnabled('WALLET_TOPUPS_ENABLED')) {
        return { error: 'Wallet top-ups are temporarily disabled. Please try again later.' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const rateLimitError = checkTopUpRateLimit(user.id)
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    const validationError = validate(topUpSchema, { amountPounds })
    if (validationError) {
        return { error: validationError }
    }

    const desiredPence = Math.round(amountPounds * 100)
    const { chargePence } = calculateChargeAmount(desiredPence)

    const { data: wallet } = await supabase
        .from('wallets')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle()

    const stripe = getStripe()
    let stripeCustomerId = wallet?.stripe_customer_id

    if (!stripeCustomerId) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .single()

        // Idempotency key collapses retries (network blip / double-submit) to
        // a single Stripe customer. Stable per user — same user always gets
        // the same customer record on retry, no orphan duplicates.
        const customer = await stripe.customers.create(
            {
                email: profile?.email ?? user.email,
                name: profile?.full_name ?? undefined,
                metadata: { supabase_user_id: user.id },
            },
            { idempotencyKey: `customer:${user.id}` }
        )

        stripeCustomerId = customer.id

        await supabase.from('wallets').upsert({
            user_id: user.id,
            stripe_customer_id: stripeCustomerId,
            balance_pence: 0,
            escrow_pence: 0,
        }, { onConflict: 'user_id' })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // Idempotency key on the Checkout session: same user + same amount on
    // the same UTC day collapses to one session. Lets a user navigate back,
    // refresh, or double-submit without spawning duplicate Stripe sessions.
    const todayUtc = new Date().toISOString().slice(0, 10)
    const sessionIdempotencyKey = `topup:${user.id}:${desiredPence}:${todayUtc}`

    const session = await stripe.checkout.sessions.create(
        {
            customer: stripeCustomerId,
            mode: 'payment',
            currency: STRIPE_CONFIG.CURRENCY,
            line_items: [{
                price_data: {
                    currency: STRIPE_CONFIG.CURRENCY,
                    product_data: {
                        name: `Wallet Top-Up — £${amountPounds.toFixed(2)}`,
                        description: `Add £${amountPounds.toFixed(2)} to your Whistle Connect wallet`,
                    },
                    unit_amount: chargePence,
                },
                quantity: 1,
            }],
            metadata: {
                supabase_user_id: user.id,
                desired_amount_pence: desiredPence.toString(),
                type: 'wallet_top_up',
            },
            success_url: `${siteUrl}/app/wallet?topup=success`,
            cancel_url: `${siteUrl}/app/wallet?topup=cancelled`,
        },
        { idempotencyKey: sessionIdempotencyKey }
    )

    return { url: session.url ?? undefined }
}

export async function requestWithdrawal(amountPounds: number): Promise<{
    success?: boolean
    error?: string
}> {
    if (!isEnabled('WITHDRAWALS_ENABLED')) {
        return { error: 'Withdrawals are temporarily disabled. Please try again later.' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const rateLimitError = checkWithdrawRateLimit(user.id)
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    const validationError = validate(withdrawSchema, { amountPounds })
    if (validationError) {
        return { error: validationError }
    }

    const amountPence = Math.round(amountPounds * 100)

    const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single()

    if (!wallet) {
        return { error: 'No wallet found' }
    }

    if (!wallet.stripe_connect_id || !wallet.stripe_connect_onboarded) {
        return { error: 'Please complete Stripe onboarding before withdrawing' }
    }

    if (wallet.balance_pence < amountPence) {
        return { error: 'Insufficient funds for withdrawal' }
    }

    // ── Atomic withdraw — three-step pre-record-intent flow ─────────────────
    // 1. begin: debit balance into pending_withdrawal_pence; insert
    //    withdrawal_requests row (status='pending'). Returns request_id.
    // 2. stripe.transfers.create with idempotencyKey = request_id (so a
    //    network retry / double-click cannot double-transfer).
    // 3a. transfer succeeded → finalise: drop the hold, write a wallet_transactions
    //    row, mark request 'completed'.
    // 3b. transfer failed → cancel: refund the hold back to balance, mark
    //    request 'failed' with the error.
    // The reconcile cron (Phase 2) sweeps requests stuck in 'pending' for
    // >1h to cover the case where the server died between step 2 and 3.

    const { data: beginResult, error: beginErr } = await supabase.rpc('wallet_withdraw_begin', {
        p_user_id: user.id,
        p_amount_pence: amountPence,
    })

    if (beginErr || beginResult?.error) {
        console.error('[Withdraw] begin failed:', beginErr || beginResult?.error)
        Sentry.captureException(beginErr || new Error(beginResult?.error || 'wallet_withdraw_begin failed'), {
            tags: { 'wallet.flow': 'withdraw', 'wallet.step': 'begin' },
            user: { id: user.id },
            extra: { amountPence },
        })
        return { error: beginResult?.error || beginErr?.message || 'Failed to start withdrawal' }
    }

    const requestId = beginResult.request_id as string
    if (!requestId) {
        // Defensive — begin returned success but no request_id. Should never happen.
        console.error('[Withdraw] begin returned success without request_id', beginResult)
        return { error: 'Withdrawal failed. Please try again later.' }
    }

    const stripe = getStripe()

    let transferId: string
    try {
        const transfer = await stripe.transfers.create(
            {
                amount: amountPence,
                currency: STRIPE_CONFIG.CURRENCY,
                destination: wallet.stripe_connect_id,
                metadata: {
                    supabase_user_id: user.id,
                    wallet_id: wallet.id,
                    withdrawal_request_id: requestId,
                    type: 'referee_withdrawal',
                },
            },
            { idempotencyKey: requestId }
        )
        transferId = transfer.id
    } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err)
        console.error('[Withdraw] Stripe transfer failed, cancelling request:', errMessage)
        Sentry.captureException(err, {
            tags: { 'wallet.flow': 'withdraw', 'wallet.step': 'stripe.transfers.create' },
            user: { id: user.id },
            extra: { requestId, amountPence },
        })
        // Best-effort cancel — refunds the hold back to the user's balance.
        const { error: cancelErr } = await supabase.rpc('wallet_withdraw_cancel', {
            p_request_id: requestId,
            p_error: errMessage,
        })
        if (cancelErr) {
            console.error('[Withdraw] cancel after stripe-failure also failed:', cancelErr)
            Sentry.captureException(cancelErr, {
                tags: { 'wallet.flow': 'withdraw', 'wallet.step': 'cancel-after-stripe-fail' },
                user: { id: user.id },
                extra: { requestId, amountPence, originalError: errMessage },
                level: 'fatal',
            })
            // The reconcile sweep will catch this stuck-pending row.
        }
        return { error: 'Withdrawal failed. Please try again later.' }
    }

    const { data: finaliseResult, error: finaliseErr } = await supabase.rpc('wallet_withdraw_finalise', {
        p_request_id: requestId,
        p_stripe_transfer_id: transferId,
    })

    if (finaliseErr || finaliseResult?.error) {
        // Stripe transferred the money but our DB couldn't finalise. Do NOT
        // refund — the money has already left. The reconcile sweep will
        // surface this as a stuck-pending request with a stripe_transfer_id
        // already attempted; an admin can manually finalise via SQL.
        console.error('[Withdraw] CRITICAL: finalise failed after successful Stripe transfer', {
            requestId,
            transferId,
            error: finaliseErr || finaliseResult?.error,
        })
        // Highest-severity Sentry event — a successful Stripe transfer that
        // didn't get recorded means the withdrawal_requests row stays
        // pending. Manually finalise via SQL: the reconcile sweep will
        // also surface this row.
        Sentry.captureException(
            finaliseErr || new Error(finaliseResult?.error || 'wallet_withdraw_finalise failed'),
            {
                tags: { 'wallet.flow': 'withdraw', 'wallet.step': 'finalise', 'wallet.severity': 'money-out-no-record' },
                user: { id: user.id },
                extra: { requestId, transferId, amountPence },
                level: 'fatal',
            },
        )
        return { error: 'Withdrawal sent but record-keeping failed. Support has been alerted.' }
    }

    revalidatePath('/app/wallet')
    return { success: true }
}

export async function createStripeConnectLink(): Promise<{
    url?: string
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const stripe = getStripe()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const { data: wallet } = await supabase
        .from('wallets')
        .select('stripe_connect_id')
        .eq('user_id', user.id)
        .maybeSingle()

    let connectId = wallet?.stripe_connect_id

    try {
        if (!connectId) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', user.id)
                .single()

            // Idempotency key collapses retries to a single Connect Express
            // account per user. Without this, a network blip during onboarding
            // could leave orphan acct_* records in Stripe.
            const account = await stripe.accounts.create(
                {
                    type: 'express',
                    country: 'GB',
                    email: profile?.email ?? user.email,
                    capabilities: {
                        transfers: { requested: true },
                    },
                    metadata: { supabase_user_id: user.id },
                },
                { idempotencyKey: `connect:${user.id}` }
            )

            connectId = account.id

            const { createAdminClient } = await import('@/lib/supabase/server')
            const adminSupabase = createAdminClient()

            await adminSupabase?.from('wallets').upsert({
                user_id: user.id,
                stripe_connect_id: connectId,
                balance_pence: 0,
                escrow_pence: 0,
            }, { onConflict: 'user_id' })
        }

        const accountLink = await stripe.accountLinks.create({
            account: connectId,
            refresh_url: `${siteUrl}/app/wallet/withdraw?connect=refresh`,
            return_url: `${siteUrl}/app/wallet/withdraw?connect=complete`,
            type: 'account_onboarding',
        })

        return { url: accountLink.url }
    } catch (err) {
        // Without this guard, a Stripe failure (e.g. platform hasn't enabled
        // Connect yet) bubbles past the 'use server' boundary and crashes the
        // server-component render of /app/wallet/withdraw.
        const errMessage = err instanceof Error ? err.message : String(err)
        console.error('[StripeConnect] onboarding link failed:', errMessage)
        Sentry.captureException(err, {
            tags: { 'wallet.flow': 'connect-onboarding' },
            user: { id: user.id },
        })

        if (errMessage.includes('signed up for Connect')) {
            return { error: 'Withdrawals are temporarily unavailable. The team has been notified.' }
        }
        return { error: 'Could not start withdrawal setup. Please try again in a moment.' }
    }
}
