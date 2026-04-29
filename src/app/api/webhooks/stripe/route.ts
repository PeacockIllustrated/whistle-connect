import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import * as Sentry from '@sentry/nextjs'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    const stripe = getStripe()
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET is not set')
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // ── Idempotency gate ────────────────────────────────────────────────
    // Stripe re-delivers events on 5xx and via the dashboard "Resend" button.
    // Track every event in webhook_events (id PK = Stripe event.id):
    //   - first delivery: insert row, run handler, set processed_at on success
    //   - retry of an already-processed event: short-circuit with 200
    //   - retry of an event whose handler PREVIOUSLY THREW (processed_at IS NULL,
    //     error IS NOT NULL): RE-RUN the handler so the failure can be recovered
    //     by the retry. Without this branch, a transient handler failure becomes
    //     permanent because the second delivery would also short-circuit.
    // The handlers' business-key idempotency (e.g. wallet_top_up checking
    // stripe_session_id) is still in place as belt-and-braces.
    const supabase = createAdminClient()
    if (!supabase) {
        console.error('[Webhook] Admin client unavailable — SUPABASE_SERVICE_ROLE_KEY missing')
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { data: existing } = await supabase
        .from('webhook_events')
        .select('id, processed_at')
        .eq('id', event.id)
        .maybeSingle()

    if (existing && existing.processed_at) {
        console.log(`[Webhook] Skipping already-processed event ${event.id} (${event.type})`)
        return NextResponse.json({ received: true, idempotent: true })
    }

    if (!existing) {
        const { error: insertErr } = await supabase
            .from('webhook_events')
            .insert({ id: event.id, type: event.type })

        if (insertErr && insertErr.code !== '23505') {
            // 23505 = unique violation — race between two concurrent deliveries
            // of the same event. Whichever lost the race will re-fetch above on
            // its next read; safe to fall through to processing.
            console.error(`[Webhook] Failed to insert webhook_events row for ${event.id}:`, insertErr)
            return NextResponse.json({ error: 'Idempotency log write failed' }, { status: 500 })
        }
    } else {
        console.log(`[Webhook] Retrying previously-failed event ${event.id} (${event.type})`)
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
                break

            case 'account.updated':
                await handleAccountUpdated(event.data.object as Stripe.Account)
                break

            case 'transfer.reversed':
                await handleTransferFailed(event.data.object as Stripe.Transfer)
                break

            default:
                break
        }

        await supabase
            .from('webhook_events')
            .update({ processed_at: new Date().toISOString() })
            .eq('id', event.id)

        return NextResponse.json({ received: true })
    } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err)
        console.error(`Webhook handler error for ${event.type}:`, err)

        // Persist the failure on the webhook_events row so we can investigate.
        await supabase
            .from('webhook_events')
            .update({ error: errMessage })
            .eq('id', event.id)

        // Tag the Sentry event with the Stripe event id and type so the
        // alerting rule can group repeats and on-call can pull the matching
        // webhook_events row from the DB.
        Sentry.captureException(err, {
            tags: {
                'stripe.event.id': event.id,
                'stripe.event.type': event.type,
                'webhook.handler': event.type,
            },
        })

        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
    }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.metadata?.type !== 'wallet_top_up') {
        return
    }

    const userId = session.metadata.supabase_user_id
    const desiredAmountPence = parseInt(session.metadata.desired_amount_pence, 10)

    if (!userId || isNaN(desiredAmountPence)) {
        console.error('Invalid metadata on checkout session:', session.id)
        return
    }

    const creditPence = desiredAmountPence

    const supabase = createAdminClient()

    if (!supabase) {
        console.error('Admin client unavailable — SUPABASE_SERVICE_ROLE_KEY missing')
        throw new Error('Admin client unavailable')
    }

    const { data: result, error } = await supabase.rpc('wallet_top_up', {
        p_user_id: userId,
        p_amount_pence: creditPence,
        p_stripe_session_id: session.id,
        p_description: `Wallet top-up: £${(creditPence / 100).toFixed(2)}`,
    })

    if (error) {
        console.error('wallet_top_up RPC failed:', error)
        throw error
    }

    if (result?.error) {
        if (result.error === 'This payment has already been processed') {
            return
        }
        console.error('wallet_top_up returned error:', result.error)
        throw new Error(result.error)
    }
}

async function handleAccountUpdated(account: Stripe.Account) {
    const userId = account.metadata?.supabase_user_id
    if (!userId) return

    const isOnboarded = account.charges_enabled && account.payouts_enabled

    const supabase = createAdminClient()
    if (!supabase) return

    await supabase
        .from('wallets')
        .update({ stripe_connect_onboarded: isOnboarded })
        .eq('stripe_connect_id', account.id)
}

async function handleTransferFailed(transfer: Stripe.Transfer) {
    const userId = transfer.metadata?.supabase_user_id
    console.error('Stripe transfer failed:', {
        transferId: transfer.id,
        userId,
        amount: transfer.amount,
    })

    if (userId) {
        const supabase = createAdminClient()
        if (!supabase) return

        const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin')

        if (admins) {
            for (const admin of admins) {
                await supabase.from('notifications').insert({
                    user_id: admin.id,
                    title: 'Transfer Failed',
                    message: `Stripe transfer ${transfer.id} failed for user ${userId}. Amount: £${(transfer.amount / 100).toFixed(2)}`,
                    type: 'error',
                    link: '/app/disputes',
                })
            }
        }
    }
}
