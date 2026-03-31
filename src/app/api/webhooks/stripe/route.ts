import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
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

        return NextResponse.json({ received: true })
    } catch (err) {
        console.error(`Webhook handler error for ${event.type}:`, err)
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
                    link: '/app/admin',
                })
            }
        }
    }
}
