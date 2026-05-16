import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { getStripe } from '@/lib/stripe/server'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    if (!supabase) {
        return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
    }

    const now = new Date()
    const mismatches: string[] = []

    // 1. Reconcile wallet balances against transaction sums
    const { data: wallets } = await supabase
        .from('wallets')
        .select('id, user_id, balance_pence, escrow_pence')

    if (wallets) {
        for (const wallet of wallets) {
            const { data: transactions } = await supabase
                .from('wallet_transactions')
                .select('amount_pence, direction')
                .eq('wallet_id', wallet.id)

            if (!transactions) continue

            let expectedBalance = 0
            for (const tx of transactions) {
                if (tx.direction === 'credit') {
                    expectedBalance += tx.amount_pence
                } else {
                    expectedBalance -= tx.amount_pence
                }
            }

            const actualTotal = wallet.balance_pence + wallet.escrow_pence
            if (actualTotal !== expectedBalance) {
                mismatches.push(
                    `Wallet ${wallet.id} (user ${wallet.user_id}): ` +
                    `expected ${expectedBalance}, actual ${actualTotal} ` +
                    `(balance: ${wallet.balance_pence}, escrow: ${wallet.escrow_pence})`
                )
            }
        }
    }

    // 2. Check for stuck escrow (>7 days past match date)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const sevenDaysAgoDate = sevenDaysAgo.toISOString().split('T')[0]

    const { data: stuckBookings } = await supabase
        .from('bookings')
        .select('id, coach_id, match_date, escrow_amount_pence')
        .eq('status', 'confirmed')
        .not('escrow_amount_pence', 'is', null)
        .is('escrow_released_at', null)
        .lt('match_date', sevenDaysAgoDate)

    // 2b. Sweep withdrawal_requests stuck in 'pending' for >1h. The atomic
    // withdraw flow (migration 0143) holds funds at `begin`, transfers via
    // Stripe, then `finalise`/`cancel`. If the server died between the Stripe
    // call and finalise/cancel, the row stays 'pending' with the user's funds
    // held. We resolve it by asking STRIPE for the ground truth:
    //   - a matching transfer exists  → finalise (record the money that left)
    //   - provably no transfer exists → cancel (refund the held funds)
    // Stripe is the source of truth, so this never double-pays or strands.
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const { data: stuckWithdrawals } = await supabase
        .from('withdrawal_requests')
        .select('id, amount_pence, created_at, wallet:wallets!inner(stripe_connect_id)')
        .eq('status', 'pending')
        .lt('created_at', oneHourAgo)
        .order('created_at', { ascending: true })
        .limit(50)

    const sweep = { finalised: 0, cancelled: 0, errors: [] as string[] }

    if (stuckWithdrawals && stuckWithdrawals.length > 0) {
        const stripe = getStripe()
        for (const w of stuckWithdrawals) {
            const wallet = Array.isArray(w.wallet) ? w.wallet[0] : w.wallet
            const connectId = wallet?.stripe_connect_id as string | undefined
            try {
                let matchedTransferId: string | null = null
                if (connectId) {
                    // Tight created window around the request so the search is
                    // exhaustive (one ref makes very few transfers in it).
                    const since = Math.floor(new Date(w.created_at).getTime() / 1000) - 300
                    const transfers = await stripe.transfers
                        .list({ destination: connectId, created: { gte: since }, limit: 100 })
                        .autoPagingToArray({ limit: 500 })
                    matchedTransferId =
                        transfers.find(t => t.metadata?.withdrawal_request_id === w.id)?.id ?? null
                }

                if (matchedTransferId) {
                    const { data: r, error } = await supabase.rpc('wallet_withdraw_finalise', {
                        p_request_id: w.id,
                        p_stripe_transfer_id: matchedTransferId,
                    })
                    if (error || r?.error) throw new Error(error?.message || r?.error)
                    sweep.finalised++
                } else {
                    const { data: r, error } = await supabase.rpc('wallet_withdraw_cancel', {
                        p_request_id: w.id,
                        p_error: 'reconcile: no Stripe transfer found >1h after begin',
                    })
                    if (error || r?.error) throw new Error(error?.message || r?.error)
                    sweep.cancelled++
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                sweep.errors.push(`withdrawal ${w.id}: ${msg}`)
                Sentry.captureException(err, {
                    tags: { 'wallet.flow': 'reconcile-sweep', 'wallet.step': 'resolve-stuck' },
                    extra: { requestId: w.id },
                    level: 'error',
                })
            }
        }
    }

    const sweepActivity = sweep.finalised + sweep.cancelled + sweep.errors.length

    // 3. Alert admins if issues found
    if (mismatches.length > 0 || (stuckBookings && stuckBookings.length > 0) || sweepActivity > 0) {
        const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin')

        if (admins) {
            const alerts: string[] = []

            if (mismatches.length > 0) {
                alerts.push(`${mismatches.length} wallet balance mismatch(es) detected`)
            }

            if (stuckBookings && stuckBookings.length > 0) {
                alerts.push(`${stuckBookings.length} booking(s) with escrow stuck >7 days past match date`)
            }

            if (sweepActivity > 0) {
                alerts.push(
                    `Stuck-withdrawal sweep: ${sweep.finalised} finalised, ` +
                    `${sweep.cancelled} refunded, ${sweep.errors.length} error(s)`
                )
            }

            for (const admin of admins) {
                await createNotification({
                    userId: admin.id,
                    title: 'Wallet Reconciliation Alert',
                    message: alerts.join('. ') + '. Please review in the admin settings.',
                    type: 'warning',
                    link: '/app/admin/settings',
                })
            }
        }
    }

    console.log('Reconciliation completed:', {
        walletsChecked: wallets?.length ?? 0,
        mismatches: mismatches.length,
        stuckEscrow: stuckBookings?.length ?? 0,
        withdrawalSweep: sweep,
        timestamp: now.toISOString(),
    })

    return NextResponse.json({
        success: true,
        walletsChecked: wallets?.length ?? 0,
        mismatches,
        stuckEscrow: stuckBookings?.map(b => b.id) ?? [],
        withdrawalSweep: sweep,
        timestamp: now.toISOString(),
    })
}
