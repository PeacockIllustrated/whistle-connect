import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'

/**
 * Admin broadcast endpoint. Sends an in-app notification + web push + FCM
 * to EVERY user who has a profile row.
 *
 * Auth: Bearer CRON_SECRET (same secret already used for cron jobs — no new
 * surface area). Returns 401 on mismatch.
 *
 * Intended for:
 *   - One-shot system tests after VAPID key rotation, where you want to
 *     prove the entire transport chain is working end-to-end on every
 *     registered device.
 *   - Genuine system-wide announcements (downtime, policy updates).
 *
 * NOT for marketing or feature-spam — that's what email/in-app banners are
 * for. Each invocation should be deliberate.
 *
 * Body (JSON):
 *   {
 *     "title":   "Required, <60 chars",
 *     "message": "Required, <300 chars",
 *     "link":    "Optional path users land on when they tap, default /app",
 *     "type":    "Optional 'info'|'success'|'warning'|'error', default 'info'",
 *     "dryRun":  "Optional bool — if true, returns the count of recipients
 *                 without firing anything. Use this first to sanity-check."
 *   }
 *
 * Response:
 *   { ok: true, recipients: number, dispatched: number, errors: string[] }
 */
export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: {
        title?: string
        message?: string
        link?: string
        type?: 'info' | 'success' | 'warning' | 'error'
        dryRun?: boolean
    }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const title = (body.title || '').trim()
    const message = (body.message || '').trim()
    if (!title || title.length > 60) {
        return NextResponse.json({ error: 'title required, max 60 chars' }, { status: 400 })
    }
    if (!message || message.length > 300) {
        return NextResponse.json({ error: 'message required, max 300 chars' }, { status: 400 })
    }
    const type = body.type || 'info'
    const link = body.link || '/app'

    const supabase = createAdminClient()
    if (!supabase) {
        return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
    }

    const { data: profiles, error: profilesErr } = await supabase
        .from('profiles')
        .select('id')

    if (profilesErr) {
        Sentry.captureException(profilesErr, { tags: { route: 'broadcast-push' } })
        return NextResponse.json({ error: profilesErr.message }, { status: 500 })
    }

    const recipients = profiles?.length ?? 0

    if (body.dryRun) {
        return NextResponse.json({
            ok: true,
            dryRun: true,
            recipients,
        })
    }

    let dispatched = 0
    const errors: string[] = []

    // createNotification already handles in-app row + web push + FCM internally,
    // and prefers the service-role client (post de37d04). Promise.allSettled so
    // one user's failure doesn't tank the broadcast.
    const results = await Promise.allSettled(
        (profiles || []).map(p =>
            createNotification({
                userId: p.id,
                title,
                message,
                type,
                link,
            })
        )
    )

    results.forEach((r, idx) => {
        if (r.status === 'rejected') {
            errors.push(`profile ${profiles![idx].id}: ${r.reason}`)
        } else if (r.value.success === false) {
            errors.push(`profile ${profiles![idx].id}: ${r.value.error}`)
        } else {
            dispatched++
        }
    })

    if (errors.length > 0) {
        Sentry.captureMessage(`broadcast-push partial failure: ${errors.length} errors`, {
            level: 'warning',
            tags: { route: 'broadcast-push' },
            extra: { errors: errors.slice(0, 20), recipients, dispatched },
        })
    }

    return NextResponse.json({
        ok: true,
        recipients,
        dispatched,
        errors,
    })
}
