// ============================================================================
// Tournament sync - seed the 48 teams and pull live results.
//
// Source of truth for STRUCTURE (teams + groups) is the baked-in WC_2026_TEAMS.
// Source for RESULTS is the public-domain openfootball feed (no API key). The
// recompute derives group standings + each team's furthest stage + eliminations
// from finished matches, which in turn drives the sweepstake leaderboard.
//
// football-data.org can be layered in later for fresher scores (optional, key
// required) - wc_matches.stats is reserved for the richer fields it provides.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { WC_2026_TEAMS, codeForName } from './teams-2026'
import { isoForFifa } from './flags'
import type { MatchStage, TeamStage } from './types'

const OPENFOOTBALL_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

interface OpenfootballMatch {
    round?: string
    date?: string
    time?: string
    team1?: string
    team2?: string
    group?: string
    ground?: string
    score?: { ft?: [number, number]; p?: [number, number] }
}

const WIN = 3
const DRAW = 1

/** Upsert the 48 teams' static fields without clobbering computed standings. */
export async function seedTeams(admin: SupabaseClient): Promise<number> {
    const rows = WC_2026_TEAMS.map((t) => ({
        code: t.code,
        name: t.name,
        country_code: isoForFifa(t.code),
        group_letter: t.group,
    }))
    const { error } = await admin.from('wc_teams').upsert(rows, { onConflict: 'code' })
    if (error) throw new Error(`seedTeams: ${error.message}`)
    return rows.length
}

/**
 * Normalise the openfootball group field to a bare letter. The feed sends
 * `"group":"Group A"` (and occasionally just `"A"`); strip a leading "Group "
 * prefix (case-insensitive) so the `^[A-L]$` test and the group_letter CHECK
 * constraint both see a bare letter. Returns undefined when nothing usable.
 */
function normaliseGroup(group: string | undefined): string | undefined {
    return (group ?? '').replace(/^Group\s+/i, '').trim() || undefined
}

function roundToStage(round: string | undefined, group: string | undefined): MatchStage {
    if (group && /^[A-L]$/.test(group)) return 'group'
    const r = (round ?? '').toLowerCase()
    if (r.includes('32')) return 'r32'
    if (r.includes('16')) return 'r16'
    if (r.includes('quarter')) return 'qf'
    if (r.includes('semi')) return 'sf'
    if (r.includes('third') || r.includes('3rd')) return 'third_place'
    if (r.includes('final')) return 'final'
    return 'group'
}

function externalId(m: OpenfootballMatch): string {
    const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    return `wc26-${norm(m.date)}-${norm(m.team1)}-${norm(m.team2)}`
}

/** Fetch + upsert fixtures/results from openfootball. Returns count synced. */
export async function syncMatches(admin: SupabaseClient): Promise<number> {
    let payload: { matches?: OpenfootballMatch[] }
    try {
        const res = await fetch(OPENFOOTBALL_URL, { cache: 'no-store' })
        if (!res.ok) {
            Sentry.captureMessage(
                `syncMatches: openfootball fetch failed (HTTP ${res.status})`,
                { level: 'warning', tags: { 'wc.flow': 'sync' } },
            )
            return 0
        }
        payload = await res.json()
    } catch (err) {
        Sentry.captureMessage('syncMatches: openfootball fetch threw', {
            level: 'warning',
            tags: { 'wc.flow': 'sync' },
            extra: { error: err instanceof Error ? err.message : String(err) },
        })
        return 0
    }
    const matches = payload.matches ?? []
    if (matches.length === 0) {
        Sentry.captureMessage('syncMatches: openfootball feed returned 0 matches', {
            level: 'warning',
            tags: { 'wc.flow': 'sync' },
        })
        return 0
    }

    const rows = matches.map((m) => {
        const groupLetter = normaliseGroup(m.group)
        const validGroup = groupLetter && /^[A-L]$/.test(groupLetter) ? groupLetter : null
        const stage = roundToStage(m.round, groupLetter)
        const homeCode = m.team1 ? codeForName(m.team1) : null
        const awayCode = m.team2 ? codeForName(m.team2) : null
        const ft = m.score?.ft
        const finished = Array.isArray(ft) && ft.length === 2
        let winner: string | null = null
        if (finished && homeCode && awayCode) {
            if (ft![0] > ft![1]) winner = homeCode
            else if (ft![1] > ft![0]) winner = awayCode
            else {
                const p = m.score?.p
                if (Array.isArray(p) && p.length === 2) winner = p[0] > p[1] ? homeCode : awayCode
            }
        }
        const kickoff = m.date ? `${m.date}T${(m.time ?? '00:00').slice(0, 5)}:00Z` : null
        return {
            external_id: externalId(m),
            stage,
            group_letter: stage === 'group' ? validGroup : null,
            home_team_code: homeCode,
            away_team_code: awayCode,
            home_label: homeCode ? null : m.team1 ?? null,
            away_label: awayCode ? null : m.team2 ?? null,
            home_score: finished ? ft![0] : null,
            away_score: finished ? ft![1] : null,
            home_pens: m.score?.p?.[0] ?? null,
            away_pens: m.score?.p?.[1] ?? null,
            winner_team_code: winner,
            status: finished ? 'finished' : 'scheduled',
            kickoff_at: kickoff,
            venue: m.ground ?? null,
            updated_at: new Date().toISOString(),
        }
    })

    const { error } = await admin.from('wc_matches').upsert(rows, { onConflict: 'external_id' })
    if (error) throw new Error(`syncMatches: ${error.message}`)

    // Full-feed replace: knockout placeholder fixtures ('1A', 'W73', …) become
    // real team names later, which produces a NEW external_id (it's built from
    // team names). Delete any wc_matches row whose external_id isn't in the set
    // we just synced so stale 'scheduled' placeholders don't linger forever.
    // A failed delete must NOT discard the successful upsert above — capture and
    // continue rather than throwing.
    const syncedIds = rows.map((r) => r.external_id)
    const { error: deleteError } = await admin
        .from('wc_matches')
        .delete()
        .not('external_id', 'in', `(${syncedIds.map((id) => `"${id}"`).join(',')})`)
    if (deleteError) {
        Sentry.captureMessage(`syncMatches: stale-row cleanup failed: ${deleteError.message}`, {
            level: 'warning',
            tags: { 'wc.flow': 'sync' },
        })
    }

    return rows.length
}

const STAGE_RANK: Record<TeamStage, number> = {
    group: 0, r32: 1, r16: 2, qf: 3, sf: 4, final: 5, champion: 6,
}

interface MatchRow {
    stage: MatchStage
    home_team_code: string | null
    away_team_code: string | null
    home_score: number | null
    away_score: number | null
    winner_team_code: string | null
    status: string
}

/**
 * Recompute group standings + each team's furthest stage + eliminations from the
 * synced matches. Idempotent: derives everything from match rows each run.
 */
export async function recomputeStandings(admin: SupabaseClient): Promise<number> {
    const { data: matchData } = await admin
        .from('wc_matches')
        .select('stage, home_team_code, away_team_code, home_score, away_score, winner_team_code, status')
    const matches = (matchData as MatchRow[] | null) ?? []

    // Start every team from a clean slate.
    type Tally = {
        played: number; won: number; drawn: number; lost: number
        gf: number; ga: number; pts: number; stage: TeamStage; eliminated: boolean
    }
    const tally = new Map<string, Tally>()
    for (const t of WC_2026_TEAMS) {
        tally.set(t.code, { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0, stage: 'group', eliminated: false })
    }

    let knockoutsStarted = false

    for (const m of matches) {
        const finished = m.status === 'finished' && m.home_score != null && m.away_score != null
        const h = m.home_team_code ? tally.get(m.home_team_code) : undefined
        const a = m.away_team_code ? tally.get(m.away_team_code) : undefined

        if (m.stage === 'group') {
            if (!finished || !h || !a) continue
            h.played++; a.played++
            h.gf += m.home_score!; h.ga += m.away_score!
            a.gf += m.away_score!; a.ga += m.home_score!
            if (m.home_score! > m.away_score!) { h.won++; h.pts += WIN; a.lost++ }
            else if (m.away_score! > m.home_score!) { a.won++; a.pts += WIN; h.lost++ }
            else { h.drawn++; a.drawn++; h.pts += DRAW; a.pts += DRAW }
        } else {
            knockoutsStarted = true
            // Furthest stage played = deepest knockout round a team appears in.
            const rank = STAGE_RANK[m.stage as TeamStage] ?? 0
            if (h && rank > STAGE_RANK[h.stage]) h.stage = m.stage as TeamStage
            if (a && rank > STAGE_RANK[a.stage]) a.stage = m.stage as TeamStage
            if (finished && m.winner_team_code) {
                const loserCode = m.winner_team_code === m.home_team_code ? m.away_team_code : m.home_team_code
                const loser = loserCode ? tally.get(loserCode) : undefined
                if (loser) loser.eliminated = true
                if (m.stage === 'final') {
                    const champ = tally.get(m.winner_team_code)
                    if (champ) champ.stage = 'champion'
                }
            }
        }
    }

    // Heuristic group-stage elimination: once knockouts have started, any team
    // that played its 3 group games but never appears in a knockout fixture is
    // out. (The 8 best third-placed teams that DO advance appear in R32, so are
    // correctly spared.)
    if (knockoutsStarted) {
        const inKnockout = new Set<string>()
        for (const m of matches) {
            if (m.stage === 'group') continue
            if (m.home_team_code) inKnockout.add(m.home_team_code)
            if (m.away_team_code) inKnockout.add(m.away_team_code)
        }
        for (const [code, t] of tally) {
            if (t.stage === 'group' && t.played >= 3 && !inKnockout.has(code)) t.eliminated = true
        }
    }

    const updatedAt = new Date().toISOString()
    let updated = 0
    for (const [code, t] of tally) {
        const { error } = await admin
            .from('wc_teams')
            .update({
                played: t.played, won: t.won, drawn: t.drawn, lost: t.lost,
                goals_for: t.gf, goals_against: t.ga, group_points: t.pts,
                stage: t.stage, eliminated: t.eliminated, updated_at: updatedAt,
            })
            .eq('code', code)
        if (!error) updated++
    }
    return updated
}

/** Full sync used by the cron + the seed route. */
export async function runFullSync(admin: SupabaseClient) {
    const teams = await seedTeams(admin)
    const matches = await syncMatches(admin)
    const recomputed = await recomputeStandings(admin)
    return { teams, matches, recomputed }
}
