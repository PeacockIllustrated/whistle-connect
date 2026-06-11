// ============================================================================
// Sweepstake scoring + the team draw.
// ============================================================================

import type { Scoring, TeamStage, WcTeam, WcSweepstakeEntry, LeaderboardRow } from './types'

/** Stage order, shallowest → deepest. Index doubles as a sortable rank. */
export const TEAM_STAGES: TeamStage[] = ['group', 'r32', 'r16', 'qf', 'sf', 'final', 'champion']

export const STAGE_LABELS: Record<TeamStage, string> = {
    group: 'Group stage',
    r32: 'Round of 32',
    r16: 'Round of 16',
    qf: 'Quarter-final',
    sf: 'Semi-final',
    final: 'Final',
    champion: 'Champion',
}

/**
 * Default points. Group wins tick the board along during the group stage;
 * stage bonuses reward survival, with a big jump for lifting the trophy.
 */
export const DEFAULT_SCORING: Scoring = {
    groupWin: 1,
    stage: {
        group: 0,
        r32: 3,
        r16: 5,
        qf: 8,
        sf: 12,
        final: 16,
        champion: 25,
    },
}

/** Merge a (possibly partial) override over the defaults. */
export function resolveScoring(override: Partial<Scoring> | null | undefined): Scoring {
    if (!override) return DEFAULT_SCORING
    return {
        groupWin: override.groupWin ?? DEFAULT_SCORING.groupWin,
        stage: { ...DEFAULT_SCORING.stage, ...(override.stage ?? {}) },
    }
}

/** Points a single team contributes: group wins + the bonus for its furthest stage. */
export function teamPoints(team: Pick<WcTeam, 'won' | 'stage'>, scoring: Scoring): number {
    return team.won * scoring.groupWin + (scoring.stage[team.stage] ?? 0)
}

/** Build a sorted leaderboard from entries and their drawn teams. */
export function buildLeaderboard(
    entries: WcSweepstakeEntry[],
    teamsByEntry: Map<string, WcTeam[]>,
    scoringOverride: Partial<Scoring> | null | undefined,
): LeaderboardRow[] {
    const scoring = resolveScoring(scoringOverride)

    const rows: LeaderboardRow[] = entries.map((entry) => {
        const teams = teamsByEntry.get(entry.id) ?? []
        const points = teams.reduce((sum, t) => sum + teamPoints(t, scoring), 0)
        const knockedOut = teams.length > 0 && teams.every((t) => t.eliminated)
        const hasChampion = teams.some((t) => t.stage === 'champion')
        return { entry, teams, points, knockedOut, hasChampion }
    })

    rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        // Tie-break: still-alive entries above knocked-out ones, then name.
        if (a.knockedOut !== b.knockedOut) return a.knockedOut ? 1 : -1
        return a.entry.participant_name.localeCompare(b.entry.participant_name)
    })

    return rows
}

// ── The draw ────────────────────────────────────────────────────────────────

/**
 * Deal already-shuffled team codes across N entries as evenly as possible
 * (snake order so any remainder is spread, not dumped on the first players).
 * Pure + deterministic for a given input — the caller shuffles the team list.
 */
export function dealTeams(shuffledTeamCodes: string[], entryCount: number): string[][] {
    const buckets: string[][] = Array.from({ length: entryCount }, () => [])
    if (entryCount <= 0) return buckets

    let index = 0
    let direction = 1
    for (const code of shuffledTeamCodes) {
        buckets[index].push(code)
        if (entryCount === 1) continue
        if (direction === 1 && index === entryCount - 1) {
            direction = -1
        } else if (direction === -1 && index === 0) {
            direction = 1
        } else {
            index += direction
        }
    }
    return buckets
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(input: T[]): T[] {
    const arr = [...input]
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}
