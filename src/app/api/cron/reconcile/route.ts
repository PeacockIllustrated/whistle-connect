import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'

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

    // 3. Alert admins if issues found
    if (mismatches.length > 0 || (stuckBookings && stuckBookings.length > 0)) {
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

            for (const admin of admins) {
                await createNotification({
                    userId: admin.id,
                    title: 'Wallet Reconciliation Alert',
                    message: alerts.join('. ') + '. Please review in admin dashboard.',
                    type: 'warning',
                    link: '/app/disputes',
                })
            }
        }
    }

    console.log('Reconciliation completed:', {
        walletsChecked: wallets?.length ?? 0,
        mismatches: mismatches.length,
        stuckEscrow: stuckBookings?.length ?? 0,
        timestamp: now.toISOString(),
    })

    return NextResponse.json({
        success: true,
        walletsChecked: wallets?.length ?? 0,
        mismatches,
        stuckEscrow: stuckBookings?.map(b => b.id) ?? [],
        timestamp: now.toISOString(),
    })
}
