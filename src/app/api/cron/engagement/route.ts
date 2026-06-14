import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { isEnabled } from '@/lib/feature-flags'

/**
 * Re-engagement nudge cron. Daily (see vercel.json) — runs at a fixed UK-evening
 * hour so "quiet hours" are handled by WHEN it runs, not per-user timezone
 * logic (the app is UK-only).
 *
 * Four nudge segments, processed highest-value first. A user receives AT MOST
 * one nudge per run, and at most one per COOLDOWN_DAYS across all segments:
 *
 *   A. ref_open_matches — available referee with open matches in their travel
 *      radius and no upcoming confirmed booking. (weekly period)
 *   B. coach_unfilled   — coach's match is within COACH_UNFILLED_HOURS and still
 *      has no referee. (per-booking period — each booking nudges once)
 *   C. ref_payout_setup — available referee who hasn't completed Stripe Connect
 *      onboarding, so match fees can't be paid out. (monthly period)
 *   D. winback          — any user dormant for DORMANT_DAYS. (weekly period)
 *
 * Idempotency + frequency cap: every send first CLAIMS a
 * (user_id, nudge_type, period_key) row in `engagement_nudges`. A duplicate
 * claim (PK conflict) means "already nudged this period" → skip. A cooldown set
 * (any nudge in the last COOLDOWN_DAYS) plus a per-run set enforce the one-per-
 * window / one-per-run caps. See migration 0173.
 *
 * Opt-out: candidate queries exclude reengagement_opt_out / suspended users, and
 * createNotification(category:'engagement') re-checks as a backstop. In-app rows
 * are always written first (independent of push transport health), so a nudge
 * lands in the bell even if a push send fails.
 */

const COOLDOWN_DAYS = 3            // no user gets more than one nudge per this window
const DORMANT_DAYS = 21           // win-back threshold (days since last_active_at)
const COACH_UNFILLED_HOURS = 48   // nudge the coach if kickoff is within this window
const MAX_REFEREES = 400          // safety cap on per-referee RPC fan-out per run
const MAX_WINBACK = 500           // safety cap on win-back fan-out per run

type ProfileLite = {
    id: string
    suspended_at: string | null
    setup_complete: boolean
    reengagement_opt_out: boolean
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10)
}

/** ISO-week period key, e.g. "2026-W24". Stable within a calendar week. */
function weekKey(d: Date): string {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const day = t.getUTCDay() || 7
    t.setUTCDate(t.getUTCDate() + 4 - day)
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
    const week = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Calendar-month period key, e.g. "2026-06". */
function monthKey(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isEnabled('ENGAGEMENT_NUDGES_ENABLED')) {
        return NextResponse.json({ success: true, skipped: 'ENGAGEMENT_NUDGES_ENABLED=false' })
    }

    const supabase = createAdminClient()
    if (!supabase) {
        return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })
    }

    const now = new Date()
    const today = isoDate(now)
    const results = {
        ref_open_matches: 0,
        coach_unfilled: 0,
        ref_payout_setup: 0,
        winback: 0,
        errors: [] as string[],
    }

    // ── Frequency-cap state ──────────────────────────────────────────────────
    // One window read → in-memory set of everyone already nudged in the cooldown
    // window. `nudgedThisRun` adds the one-per-run cap on top.
    const cooldownSince = new Date(now.getTime() - COOLDOWN_DAYS * 86400000).toISOString()
    const { data: recentNudges } = await supabase
        .from('engagement_nudges')
        .select('user_id')
        .gte('sent_at', cooldownSince)
    const inCooldown = new Set((recentNudges ?? []).map(r => r.user_id))
    const nudgedThisRun = new Set<string>()

    /** Claim a dedupe slot. False = already claimed this period (PK conflict). */
    async function claimNudge(userId: string, nudgeType: string, periodKey: string): Promise<boolean> {
        const { error } = await supabase!
            .from('engagement_nudges')
            .insert({ user_id: userId, nudge_type: nudgeType, period_key: periodKey })
        if (error) {
            if (error.code !== '23505') {
                results.errors.push(`claim ${nudgeType}/${userId}: ${error.message}`)
                Sentry.captureException(error, {
                    tags: { 'engagement.step': 'claim', 'engagement.type': nudgeType },
                    extra: { userId, periodKey },
                })
            }
            return false
        }
        return true
    }

    /**
     * Gate + claim + send. Returns true if a nudge was actually dispatched.
     * Enforces the cooldown / one-per-run caps, claims the dedupe slot, then
     * sends as category:'engagement' (opt-out / suspension honoured downstream).
     */
    async function maybeNudge(
        userId: string,
        nudgeType: string,
        periodKey: string,
        payload: { title: string; message: string; type: 'info' | 'success' | 'warning'; link: string },
    ): Promise<boolean> {
        if (inCooldown.has(userId) || nudgedThisRun.has(userId)) return false
        if (!(await claimNudge(userId, nudgeType, periodKey))) return false
        nudgedThisRun.add(userId)
        await createNotification({
            userId,
            title: payload.title,
            message: payload.message,
            type: payload.type,
            link: payload.link,
            category: 'engagement',
        })
        return true
    }

    // ── Eligible referees (shared by segments A and C) ───────────────────────
    // Available + not age-locked + not suspended + onboarded + opted-in.
    const { data: refRows, error: refErr } = await supabase
        .from('referee_profiles')
        .select('profile_id, travel_radius_km, parental_consent_status, profiles!inner(id, suspended_at, setup_complete, reengagement_opt_out)')
        .eq('is_available', true)
        .limit(MAX_REFEREES)
    if (refErr) results.errors.push(`referee fetch: ${refErr.message}`)

    const eligibleRefs = (refRows ?? [])
        .map(r => {
            const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as ProfileLite | undefined
            return p ? { profileId: r.profile_id as string, radiusKm: (r.travel_radius_km as number) ?? 30, consent: r.parental_consent_status as string, profile: p } : null
        })
        .filter((r): r is NonNullable<typeof r> =>
            !!r && !r.profile.suspended_at && r.profile.setup_complete && !r.profile.reengagement_opt_out
            && (r.consent === 'not_required' || r.consent === 'verified'))

    // ── Segment A: referee with open matches nearby, not already booked ──────
    // Referees who already hold an upcoming confirmed/completed assignment are
    // "engaged" — skip them.
    const { data: assignedRows } = await supabase
        .from('booking_assignments')
        .select('referee_id, bookings!inner(match_date, status)')
        .gte('bookings.match_date', today)
        .in('bookings.status', ['confirmed', 'completed'])
    const bookedRefIds = new Set((assignedRows ?? []).map(a => a.referee_id))

    for (const ref of eligibleRefs) {
        if (inCooldown.has(ref.profileId) || nudgedThisRun.has(ref.profileId)) continue
        if (bookedRefIds.has(ref.profileId)) continue

        const { data: nearby, error: rpcErr } = await supabase.rpc('find_bookings_near_referee', {
            p_referee_id: ref.profileId,
            p_radius_km: ref.radiusKm,
        })
        if (rpcErr) {
            results.errors.push(`find_bookings_near_referee/${ref.profileId}: ${rpcErr.message}`)
            continue
        }
        const open = (nearby ?? []) as Array<{ match_date: string; ground_name: string | null; location_postcode: string }>
        if (open.length === 0) continue

        // RPC orders by match_date ASC — open[0] is the soonest.
        const soonest = open[0]
        const venue = soonest.ground_name || soonest.location_postcode
        const when = new Date(`${soonest.match_date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
        const count = open.length

        const sent = await maybeNudge(ref.profileId, 'ref_open_matches', weekKey(now), {
            title: count === 1 ? 'A match near you needs a referee' : `${count} matches near you need a referee`,
            message: `${count === 1 ? 'A match' : `${count} matches`} in your area need an official — including ${venue} on ${when}. Open the feed to offer to ref.`,
            type: 'info',
            link: '/app/feed',
        })
        if (sent) results.ref_open_matches++
    }

    // ── Segment B: coach with an unfilled match within COACH_UNFILLED_HOURS ───
    // status pending/offered already means no confirmed assignment exists.
    const windowEnd = isoDate(new Date(now.getTime() + 3 * 86400000)) // pad; precise kickoff filter below
    const { data: openBookings } = await supabase
        .from('bookings')
        .select('id, coach_id, match_date, kickoff_time, ground_name, location_postcode')
        .in('status', ['pending', 'offered'])
        .is('deleted_at', null)
        .gte('match_date', today)
        .lte('match_date', windowEnd)

    if (openBookings && openBookings.length > 0) {
        const coachIds = [...new Set(openBookings.map(b => b.coach_id))]
        const { data: coaches } = await supabase
            .from('profiles')
            .select('id, suspended_at, setup_complete, reengagement_opt_out')
            .in('id', coachIds)
        const coachMap = new Map((coaches ?? []).map(c => [c.id, c as ProfileLite]))
        const cutoff = now.getTime() + COACH_UNFILLED_HOURS * 3600000

        for (const b of openBookings) {
            const coach = coachMap.get(b.coach_id)
            if (!coach || coach.suspended_at || !coach.setup_complete || coach.reengagement_opt_out) continue

            const kickoffAt = new Date(`${b.match_date}T${b.kickoff_time}`)
            if (isNaN(kickoffAt.getTime()) || kickoffAt.getTime() < now.getTime() || kickoffAt.getTime() > cutoff) continue

            const venue = b.ground_name || b.location_postcode
            const when = kickoffAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
            // period_key = booking id → each booking nudges at most once, ever.
            const sent = await maybeNudge(b.coach_id, 'coach_unfilled', b.id, {
                title: 'Your match still needs a referee',
                message: `Your match at ${venue} on ${when} is coming up and has no referee yet. Send another offer to get it covered.`,
                type: 'warning',
                link: `/app/bookings/${b.id}`,
            })
            if (sent) results.coach_unfilled++
        }
    }

    // ── Segment C: available referee who can't be paid (no Stripe onboarding) ─
    const refUserIds = eligibleRefs.map(r => r.profileId)
    if (refUserIds.length > 0) {
        const { data: wallets } = await supabase
            .from('wallets')
            .select('user_id, stripe_connect_onboarded')
            .in('user_id', refUserIds)
        const onboarded = new Set((wallets ?? []).filter(w => w.stripe_connect_onboarded).map(w => w.user_id))

        for (const ref of eligibleRefs) {
            if (inCooldown.has(ref.profileId) || nudgedThisRun.has(ref.profileId)) continue
            if (onboarded.has(ref.profileId)) continue
            const sent = await maybeNudge(ref.profileId, 'ref_payout_setup', monthKey(now), {
                title: 'Set up payouts to get paid',
                message: 'Add your payout details so match fees land in your wallet and can be withdrawn. It only takes a minute.',
                type: 'info',
                link: '/app/wallet',
            })
            if (sent) results.ref_payout_setup++
        }
    }

    // ── Segment D: win-back for dormant users ────────────────────────────────
    const dormantBefore = new Date(now.getTime() - DORMANT_DAYS * 86400000).toISOString()
    const { data: dormant } = await supabase
        .from('profiles')
        .select('id, role')
        .lt('last_active_at', dormantBefore)
        .is('suspended_at', null)
        .eq('setup_complete', true)
        .eq('reengagement_opt_out', false)
        .limit(MAX_WINBACK)

    for (const u of dormant ?? []) {
        if (inCooldown.has(u.id) || nudgedThisRun.has(u.id)) continue
        const message = u.role === 'referee'
            ? 'New matches near you need a referee. Open the app to see what’s available and get booked in.'
            : u.role === 'coach'
            ? 'Need a referee for an upcoming match? Post a booking and get matched with local officials.'
            : 'Come back and see what’s new on Whistle Connect.'
        const sent = await maybeNudge(u.id, 'winback', weekKey(now), {
            title: 'We’ve missed you at Whistle Connect',
            message,
            type: 'info',
            link: '/app',
        })
        if (sent) results.winback++
    }

    console.log('Engagement cron completed:', results)
    if (results.errors.length > 0) {
        Sentry.captureMessage(`engagement cron: ${results.errors.length} error(s)`, {
            level: 'warning',
            tags: { route: 'cron-engagement' },
            extra: { errors: results.errors.slice(0, 20) },
        })
    }

    return NextResponse.json({ success: true, ...results, timestamp: now.toISOString() })
}
