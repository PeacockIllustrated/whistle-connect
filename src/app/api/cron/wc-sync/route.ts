import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/server'
import { runFullSync } from '@/lib/world-cup/sync'

/**
 * World Cup tournament sync. Seeds the 48 teams (idempotent), pulls fixtures +
 * results from the public-domain openfootball feed, and recomputes group
 * standings, each team's furthest stage, eliminations and the champion — which
 * drives every sweepstake leaderboard. Auth: Bearer CRON_SECRET (Vercel injects
 * it on cron-triggered requests).
 */
export async function GET(req: NextRequest) {
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
        Sentry.captureException(err, { tags: { 'wc.flow': 'sync' } })
        const message = err instanceof Error ? err.message : 'sync failed'
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}
