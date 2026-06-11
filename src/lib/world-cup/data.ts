// ============================================================================
// World Cup read helpers - called directly from server components.
// Tournament data is world-readable; sweepstake reads are organiser-scoped via
// RLS, except the public share view which uses the service-role admin client
// (same pattern as the parent-consent / fa-verify token pages).
// ============================================================================

import { createClient, createAdminClient } from '@/lib/supabase/server'
import type {
    WcTeam,
    WcMatch,
    WcSweepstake,
    WcSweepstakeEntry,
    LeaderboardRow,
} from './types'
import { buildLeaderboard } from './scoring'

/** All 48 teams. */
export async function getTeams(): Promise<WcTeam[]> {
    const supabase = await createClient()
    const { data } = await supabase.from('wc_teams').select('*')
    return (data as WcTeam[] | null) ?? []
}

/** Teams grouped A→L, each sorted by group points then goal difference. */
export async function getGroups(): Promise<{ letter: string; teams: WcTeam[] }[]> {
    const teams = await getTeams()
    const byGroup = new Map<string, WcTeam[]>()
    for (const t of teams) {
        if (!t.group_letter) continue
        const arr = byGroup.get(t.group_letter) ?? []
        arr.push(t)
        byGroup.set(t.group_letter, arr)
    }
    const gd = (t: WcTeam) => t.goals_for - t.goals_against
    return [...byGroup.keys()].sort().map((letter) => ({
        letter,
        teams: (byGroup.get(letter) ?? []).sort(
            (a, b) =>
                b.group_points - a.group_points ||
                gd(b) - gd(a) ||
                b.goals_for - a.goals_for ||
                a.name.localeCompare(b.name),
        ),
    }))
}

/** Fixtures, optionally filtered by stage. Ordered by kickoff. */
export async function getMatches(stage?: string): Promise<WcMatch[]> {
    const supabase = await createClient()
    let query = supabase.from('wc_matches').select('*').order('kickoff_at', { ascending: true })
    if (stage) query = query.eq('stage', stage)
    const { data } = await query
    return (data as WcMatch[] | null) ?? []
}

export interface RecentResult {
    id: string
    stage: string
    group_letter: string | null
    kickoff_at: string | null
    home: { code: string; name: string; country_code: string | null } | null
    away: { code: string; name: string; country_code: string | null } | null
    homeScore: number | null
    awayScore: number | null
    homePens: number | null
    awayPens: number | null
    winnerCode: string | null
}

/** Most recently finished matches (newest first) for the landing results strip. */
export async function getRecentResults(limit = 6): Promise<RecentResult[]> {
    const supabase = await createClient()
    const { data } = await supabase
        .from('wc_matches')
        .select('*')
        .eq('status', 'finished')
        .order('kickoff_at', { ascending: false })
        .limit(limit)

    const matches = (data as WcMatch[] | null) ?? []
    if (matches.length === 0) return []

    const teams = await getTeams()
    const byCode = new Map(teams.map((t) => [t.code, t]))
    const pick = (code: string | null) => {
        const t = code ? byCode.get(code) : undefined
        return t ? { code: t.code, name: t.name, country_code: t.country_code } : null
    }

    return matches.map((m) => ({
        id: m.id,
        stage: m.stage,
        group_letter: m.group_letter,
        kickoff_at: m.kickoff_at,
        home: pick(m.home_team_code),
        away: pick(m.away_team_code),
        homeScore: m.home_score,
        awayScore: m.away_score,
        homePens: m.home_pens,
        awayPens: m.away_pens,
        winnerCode: m.winner_team_code,
    }))
}

/** The reigning champion, if decided. */
export async function getChampion(): Promise<WcTeam | null> {
    const teams = await getTeams()
    return teams.find((t) => t.stage === 'champion') ?? null
}

// ── Sweepstakes ─────────────────────────────────────────────────────────────

/** The signed-in organiser's pools (RLS-scoped). */
export async function getMySweepstakes(): Promise<WcSweepstake[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
        .from('wc_sweepstakes')
        .select('*')
        .eq('organiser_id', user.id)
        .order('created_at', { ascending: false })
    return (data as WcSweepstake[] | null) ?? []
}

interface SweepstakeDetail {
    sweepstake: WcSweepstake
    leaderboard: LeaderboardRow[]
    isOrganiser: boolean
}

/** Load a sweepstake + computed leaderboard for the organiser's manage view. */
export async function getSweepstakeForOrganiser(id: string): Promise<SweepstakeDetail | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: sweepstake } = await supabase
        .from('wc_sweepstakes')
        .select('*')
        .eq('id', id)
        .maybeSingle()
    if (!sweepstake) return null

    return buildDetail(sweepstake as WcSweepstake, user.id)
}

/** Load a sweepstake by its public share slug (admin client - no account needed). */
export async function getSweepstakeByShareId(shareId: string): Promise<SweepstakeDetail | null> {
    const admin = createAdminClient()
    if (!admin) return null

    const { data: sweepstake } = await admin
        .from('wc_sweepstakes')
        .select('*')
        .eq('share_id', shareId)
        .maybeSingle()
    if (!sweepstake) return null

    const { data: { user } } = await (await createClient()).auth.getUser()
    return buildDetail(sweepstake as WcSweepstake, user?.id ?? null, admin)
}

/** Shared loader: pull entries + their teams and compute the leaderboard. */
async function buildDetail(
    sweepstake: WcSweepstake,
    viewerId: string | null,
    client?: ReturnType<typeof createAdminClient>,
): Promise<SweepstakeDetail> {
    const db = client ?? createAdminClient() ?? (await createClient())

    const { data: entries } = await db
        .from('wc_sweepstake_entries')
        .select('*')
        .eq('sweepstake_id', sweepstake.id)
        .order('created_at', { ascending: true })

    const entryList = (entries as WcSweepstakeEntry[] | null) ?? []

    const { data: entryTeams } = await db
        .from('wc_sweepstake_entry_teams')
        .select('entry_id, team_code')
        .eq('sweepstake_id', sweepstake.id)

    const { data: teams } = await db.from('wc_teams').select('*')
    const teamByCode = new Map<string, WcTeam>()
    for (const t of (teams as WcTeam[] | null) ?? []) teamByCode.set(t.code, t)

    const teamsByEntry = new Map<string, WcTeam[]>()
    for (const row of (entryTeams as { entry_id: string; team_code: string }[] | null) ?? []) {
        const team = teamByCode.get(row.team_code)
        if (!team) continue
        const arr = teamsByEntry.get(row.entry_id) ?? []
        arr.push(team)
        teamsByEntry.set(row.entry_id, arr)
    }

    const leaderboard = buildLeaderboard(entryList, teamsByEntry, sweepstake.scoring)

    return {
        sweepstake,
        leaderboard,
        isOrganiser: viewerId === sweepstake.organiser_id,
    }
}
