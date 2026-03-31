'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getStripe } from '@/lib/stripe/server'
import { calculateChargeAmount, STRIPE_CONFIG } from '@/lib/stripe/config'
import { validate, topUpSchema, withdrawSchema } from '@/lib/validation'
import { checkTopUpRateLimit, checkWithdrawRateLimit } from '@/lib/rate-limit'
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

        const customer = await stripe.customers.create({
            email: profile?.email ?? user.email,
            name: profile?.full_name ?? undefined,
            metadata: { supabase_user_id: user.id },
        })

        stripeCustomerId = customer.id

        await supabase.from('wallets').upsert({
            user_id: user.id,
            stripe_customer_id: stripeCustomerId,
            balance_pence: 0,
            escrow_pence: 0,
        }, { onConflict: 'user_id' })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
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
    })

    return { url: session.url ?? undefined }
}

export async function requestWithdrawal(amountPounds: number): Promise<{
    success?: boolean
    error?: string
}> {
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

    const stripe = getStripe()

    try {
        const transfer = await stripe.transfers.create({
            amount: amountPence,
            currency: STRIPE_CONFIG.CURRENCY,
            destination: wallet.stripe_connect_id,
            metadata: {
                supabase_user_id: user.id,
                wallet_id: wallet.id,
                type: 'referee_withdrawal',
            },
        })

        const { data: result, error: rpcError } = await supabase.rpc('wallet_withdraw', {
            p_user_id: user.id,
            p_amount_pence: amountPence,
            p_stripe_transfer_id: transfer.id,
            p_description: `Withdrawal of £${amountPounds.toFixed(2)} to bank account`,
        })

        if (rpcError || result?.error) {
            console.error('Wallet withdraw RPC failed after Stripe transfer:', rpcError || result?.error)
            return { error: 'Withdrawal partially processed. Please contact support.' }
        }

        revalidatePath('/app/wallet')
        return { success: true }
    } catch (err) {
        console.error('Stripe transfer failed:', err)
        return { error: 'Withdrawal failed. Please try again later.' }
    }
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

    if (!connectId) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .single()

        const account = await stripe.accounts.create({
            type: 'express',
            country: 'GB',
            email: profile?.email ?? user.email,
            capabilities: {
                transfers: { requested: true },
            },
            metadata: { supabase_user_id: user.id },
        })

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
}
