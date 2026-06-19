// ============================================================================
// Sweepstake scoring + the team draw.
// ============================================================================

import type {
    Scoring,
    TeamStage,
    WcTeam,
    WcMatch,
    WcSweepstakeEntry,
    LeaderboardRow,
    TeamRecord,
    TeamContribution,
} from './types'

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
 * Default points (robust). Every win and draw — group OR knockout — moves the
 * board, stage bonuses reward how far a team survives, and lifting the trophy
 * is the jackpot. Goal difference is the tie-break, not a point source.
 */
export const DEFAULT_SCORING: Scoring = {
    win: 3,
    draw: 1,
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
        win: override.win ?? DEFAULT_SCORING.win,
        draw: override.draw ?? DEFAULT_SCORING.draw,
        stage: { ...DEFAULT_SCORING.stage, ...(override.stage ?? {}) },
    }
}

/** A zeroed record. Spread it (`{ ...EMPTY_RECORD }`) to get a fresh mutable copy. */
export const EMPTY_RECORD: TeamRecord = {
    played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0,
}

type MatchResultFields = Pick<
    WcMatch,
    'home_team_code' | 'away_team_code' | 'home_score' | 'away_score' | 'winner_team_code' | 'status'
>

/**
 * Tally every team's record from finished matches (group + knockout). A knockout
 * decided on penalties counts as a win for the side that advanced (its code is in
 * winner_team_code) and a loss for the other; goals are the regulation/ET score —
 * shootout penalties are not added to GF/GA, matching how records are normally
 * reported. Returns a map keyed by team code.
 */
export function computeTeamRecords(matches: MatchResultFields[]): Map<string, TeamRecord> {
    const records = new Map<string, TeamRecord>()
    const ensure = (code: string): TeamRecord => {
        let r = records.get(code)
        if (!r) { r = { ...EMPTY_RECORD }; records.set(code, r) }
        return r
    }
    for (const m of matches) {
        if (m.status !== 'finished' || m.home_score == null || m.away_score == null) continue
        const home = m.home_team_code
        const away = m.away_team_code
        if (!home || !away) continue
        const h = ensure(home)
        const a = ensure(away)
        h.played++; a.played++
        h.goalsFor += m.home_score; h.goalsAgainst += m.away_score
        a.goalsFor += m.away_score; a.goalsAgainst += m.home_score
        if (m.winner_team_code === home) { h.won++; a.lost++ }
        else if (m.winner_team_code === away) { a.won++; h.lost++ }
        else { h.drawn++; a.drawn++ }
    }
    for (const r of records.values()) r.goalDiff = r.goalsFor - r.goalsAgainst
    return records
}

/** Sum a set of team records into one aggregate record. */
function sumRecords(records: TeamRecord[]): TeamRecord {
    const total = { ...EMPTY_RECORD }
    for (const r of records) {
        total.played += r.played
        total.won += r.won
        total.drawn += r.drawn
        total.lost += r.lost
        total.goalsFor += r.goalsFor
        total.goalsAgainst += r.goalsAgainst
    }
    total.goalDiff = total.goalsFor - total.goalsAgainst
    return total
}

/** Points a single team contributes: wins + draws + the bonus for its furthest stage. */
export function teamPoints(record: TeamRecord, stage: TeamStage, scoring: Scoring): number {
    return record.won * scoring.win + record.drawn * scoring.draw + (scoring.stage[stage] ?? 0)
}

/** Build a sorted leaderboard from entries, their drawn teams, and team records. */
export function buildLeaderboard(
    entries: WcSweepstakeEntry[],
    teamsByEntry: Map<string, WcTeam[]>,
    recordsByCode: Map<string, TeamRecord>,
    scoringOverride: Partial<Scoring> | null | undefined,
): LeaderboardRow[] {
    const scoring = resolveScoring(scoringOverride)

    const rows: LeaderboardRow[] = entries.map((entry) => {
        const teams = teamsByEntry.get(entry.id) ?? []
        const contributions: TeamContribution[] = teams
            .map((team) => {
                const record = recordsByCode.get(team.code) ?? { ...EMPTY_RECORD }
                return { team, record, points: teamPoints(record, team.stage, scoring) }
            })
            .sort((a, b) => b.points - a.points)
        const points = contributions.reduce((sum, c) => sum + c.points, 0)
        const record = sumRecords(contributions.map((c) => c.record))
        const knockedOut = teams.length > 0 && teams.every((t) => t.eliminated)
        const hasChampion = teams.some((t) => t.stage === 'champion')
        return { entry, teams, points, record, contributions, knockedOut, hasChampion }
    })

    rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        // Tie-break: still-alive entries above knocked-out ones, then goal
        // difference, then goals scored, then name.
        if (a.knockedOut !== b.knockedOut) return a.knockedOut ? 1 : -1
        if (b.record.goalDiff !== a.record.goalDiff) return b.record.goalDiff - a.record.goalDiff
        if (b.record.goalsFor !== a.record.goalsFor) return b.record.goalsFor - a.record.goalsFor
        return a.entry.participant_name.localeCompare(b.entry.participant_name)
    })

    return rows
}

export interface SweepstakeWinners {
    /** Current points leader (the final points winner once the cup is decided). */
    pointsLeader: LeaderboardRow | null
    /** The entry holding the champion team, once the final has been played. */
    cupWinner: LeaderboardRow | null
    /** True once a champion team exists (i.e. the tournament is decided). */
    decided: boolean
}

/** Pick out the two headline winners from a sorted leaderboard. */
export function sweepstakeWinners(rows: LeaderboardRow[]): SweepstakeWinners {
    const cupWinner = rows.find((r) => r.hasChampion) ?? null
    return { pointsLeader: rows[0] ?? null, cupWinner, decided: !!cupWinner }
}

// ── The draw ────────────────────────────────────────────────────────────────

/**
 * Deal already-shuffled team codes across N entries as evenly as possible
 * (snake order so any remainder is spread, not dumped on the first players).
 * Pure + deterministic for a given input - the caller shuffles the team list.
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
