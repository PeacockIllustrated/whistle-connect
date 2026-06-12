// ============================================================================
// football-data.org results overlay — the authoritative SCORES source.
//
// openfootball gives us STRUCTURE (the 104 fixtures, teams, groups) reliably,
// but its score field is volunteer-maintained and lags badly (the 2026 opener
// was still unscored a day later). football-data.org provides real results, so
// we overlay finished/live scores onto the matching wc_matches rows AFTER the
// openfootball fixture sync. Because syncMatches nulls scores from the (empty)
// openfootball feed first, this overlay re-applies the real scores on every cron
// cycle — they survive indefinitely without a manual "don't clobber" flag.
//
// Inert without FOOTBALL_DATA_API_KEY: returns 0 and the tracker degrades to the
// openfootball-only behaviour rather than breaking. One request per cron run
// (well within the free tier's 10 req/min).
//
// Match key is the unordered pair of OUR FIFA team codes — both sources resolve
// names through the same alias map (codeForName), so the codes line up; we then
// orient the score to our row's home/away. A repeated pairing (group + a later
// knockout) is disambiguated by the closest kickoff date.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { WC_2026_TEAMS, codeForName } from './teams-2026'

const COMPETITION = process.env.FOOTBALL_DATA_COMPETITION || 'WC'
const FD_MATCHES_URL = `https://api.football-data.org/v4/competitions/${COMPETITION}/matches`

const VALID_CODES = new Set(WC_2026_TEAMS.map((t) => t.code))

interface FdTeam {
    name?: string | null
    shortName?: string | null
    tla?: string | null
}
interface FdScore {
    winner?: string | null
    fullTime?: { home: number | null; away: number | null }
    penalties?: { home: number | null; away: number | null }
}
interface FdMatch {
    status?: string
    utcDate?: string
    homeTeam?: FdTeam
    awayTeam?: FdTeam
    score?: FdScore
}

interface DbMatch {
    id: string
    home_team_code: string | null
    away_team_code: string | null
    kickoff_at: string | null
}

/** Resolve a football-data team to our FIFA code. Prefer the alias map (keeps us
 *  consistent with the codes openfootball seeded), fall back to the tla. */
function resolveCode(t: FdTeam | undefined | null): string | null {
    if (!t) return null
    const byName = t.name ? codeForName(t.name) : null
    if (byName && VALID_CODES.has(byName)) return byName
    const byShort = t.shortName ? codeForName(t.shortName) : null
    if (byShort && VALID_CODES.has(byShort)) return byShort
    if (t.tla && VALID_CODES.has(t.tla)) return t.tla
    return null
}

const pairKey = (a: string, b: string): string => [a, b].sort().join('|')

/**
 * Overlay football-data.org results onto wc_matches. Returns the number of rows
 * updated. Safe no-op (returns 0) when the API key is missing or the fetch fails.
 */
export async function applyFootballDataScores(admin: SupabaseClient): Promise<number> {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY
    if (!apiKey) return 0

    let payload: { matches?: FdMatch[] }
    try {
        const res = await fetch(FD_MATCHES_URL, {
            headers: { 'X-Auth-Token': apiKey },
            cache: 'no-store',
        })
        if (!res.ok) {
            Sentry.captureMessage(`applyFootballDataScores: football-data HTTP ${res.status}`, {
                level: 'warning',
                tags: { 'wc.flow': 'sync' },
            })
            return 0
        }
        payload = await res.json()
    } catch (err) {
        Sentry.captureMessage('applyFootballDataScores: football-data fetch threw', {
            level: 'warning',
            tags: { 'wc.flow': 'sync' },
            extra: { error: err instanceof Error ? err.message : String(err) },
        })
        return 0
    }

    const fdMatches = payload.matches ?? []
    if (fdMatches.length === 0) return 0

    // Index our rows (those with both team codes resolved) by unordered pair.
    const { data: dbData, error: dbError } = await admin
        .from('wc_matches')
        .select('id, home_team_code, away_team_code, kickoff_at')
    if (dbError) {
        Sentry.captureMessage(`applyFootballDataScores: wc_matches read failed: ${dbError.message}`, {
            level: 'warning',
            tags: { 'wc.flow': 'sync' },
        })
        return 0
    }
    const byPair = new Map<string, DbMatch[]>()
    for (const r of (dbData as DbMatch[] | null) ?? []) {
        if (!r.home_team_code || !r.away_team_code) continue
        const k = pairKey(r.home_team_code, r.away_team_code)
        const list = byPair.get(k) ?? []
        list.push(r)
        byPair.set(k, list)
    }

    let updated = 0
    for (const m of fdMatches) {
        const status = (m.status ?? '').toUpperCase()
        const isFinished = status === 'FINISHED'
        const isLive = status === 'IN_PLAY' || status === 'PAUSED'
        if (!isFinished && !isLive) continue

        const ft = m.score?.fullTime
        if (!ft || ft.home == null || ft.away == null) continue

        const fdHome = resolveCode(m.homeTeam)
        const fdAway = resolveCode(m.awayTeam)
        if (!fdHome || !fdAway || fdHome === fdAway) continue

        const candidates = byPair.get(pairKey(fdHome, fdAway))
        if (!candidates || candidates.length === 0) continue

        // Disambiguate a repeated pairing by the closest kickoff date; a single
        // candidate (the common case) skips this.
        let row = candidates[0]
        if (candidates.length > 1 && m.utcDate) {
            const target = new Date(m.utcDate).getTime()
            row = candidates.reduce((best, c) => {
                const bd = best.kickoff_at ? Math.abs(new Date(best.kickoff_at).getTime() - target) : Infinity
                const cd = c.kickoff_at ? Math.abs(new Date(c.kickoff_at).getTime() - target) : Infinity
                return cd < bd ? c : best
            }, candidates[0])
        }

        // Orient the score to OUR row's home/away.
        const rowHomeIsFdHome = row.home_team_code === fdHome
        const homeScore = rowHomeIsFdHome ? ft.home : ft.away
        const awayScore = rowHomeIsFdHome ? ft.away : ft.home

        const pens = m.score?.penalties
        const hasPens = !!pens && pens.home != null && pens.away != null
        const homePens = hasPens ? (rowHomeIsFdHome ? pens!.home : pens!.away) : null
        const awayPens = hasPens ? (rowHomeIsFdHome ? pens!.away : pens!.home) : null

        // Winner as one of our codes (null on a group-stage draw).
        let winnerCode: string | null = null
        if (ft.home > ft.away) winnerCode = fdHome
        else if (ft.away > ft.home) winnerCode = fdAway
        else if (hasPens && pens!.home != null && pens!.away != null) {
            winnerCode = pens!.home > pens!.away ? fdHome : fdAway
        }

        const { error: updErr } = await admin
            .from('wc_matches')
            .update({
                home_score: homeScore,
                away_score: awayScore,
                home_pens: homePens,
                away_pens: awayPens,
                winner_team_code: winnerCode,
                status: isFinished ? 'finished' : 'live',
                updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)

        if (updErr) {
            Sentry.captureMessage(`applyFootballDataScores: update failed for ${row.id}: ${updErr.message}`, {
                level: 'warning',
                tags: { 'wc.flow': 'sync' },
            })
            continue
        }
        updated++
    }

    return updated
}
