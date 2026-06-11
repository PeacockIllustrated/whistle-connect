import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { runFullSync } from '@/lib/world-cup/sync'

/**
 * Manual one-shot seed / resync for the World Cup tournament data. Same work as
 * the cron, exposed for an admin to fire on demand (e.g. right after deploying,
 * before the cron's first tick). Auth: Bearer CRON_SECRET.
 *
 *   curl -X POST https://www.whistleconnect.co.uk/api/admin/wc-seed \
 *        -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    if (!admin) {
        return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
    }

    try {
        const result = await runFullSync(admin)
        return NextResponse.json({ success: true, ...result })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'seed failed'
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}
