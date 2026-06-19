// ============================================================================
// World Cup tracker + sweepstake - shared types (mirrors migration 0169).
// ============================================================================

/** Furthest stage a team has reached - drives sweepstake points. */
export type TeamStage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | 'champion'

/** A fixture's stage in the bracket. */
export type MatchStage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third_place' | 'final'

export type MatchStatus = 'scheduled' | 'live' | 'finished'

export type SweepstakeStatus = 'draft' | 'drawn' | 'complete'

export interface WcTeam {
    code: string
    name: string
    country_code: string | null
    group_letter: string | null
    stage: TeamStage
    eliminated: boolean
    played: number
    won: number
    drawn: number
    lost: number
    goals_for: number
    goals_against: number
    group_points: number
    updated_at: string
}

export interface WcMatch {
    id: string
    external_id: string | null
    stage: MatchStage
    group_letter: string | null
    match_number: number | null
    home_team_code: string | null
    away_team_code: string | null
    home_label: string | null
    away_label: string | null
    home_score: number | null
    away_score: number | null
    home_pens: number | null
    away_pens: number | null
    winner_team_code: string | null
    status: MatchStatus
    kickoff_at: string | null
    venue: string | null
    stats: Record<string, unknown>
    updated_at: string
}

export interface WcSweepstake {
    id: string
    organiser_id: string
    name: string
    share_id: string
    teams_per_player: number | null
    scoring: Partial<Scoring> | null
    status: SweepstakeStatus
    created_at: string
    updated_at: string
}

export interface WcSweepstakeEntry {
    id: string
    sweepstake_id: string
    participant_name: string
    claimed_by: string | null
    claim_token: string
    created_at: string
}

export interface WcEntryTeam {
    sweepstake_id: string
    entry_id: string
    team_code: string
}

// ── Scoring ─────────────────────────────────────────────────────────────────

/** Points configuration for a sweepstake. */
export interface Scoring {
    /** Points per match won (group or knockout). */
    win: number
    /** Points per match drawn. */
    draw: number
    /** Bonus points awarded for the furthest stage a team reaches. */
    stage: Record<TeamStage, number>
}

// ── Derived (computed) view models ──────────────────────────────────────────

/** A team's tournament record across all finished matches (group + knockout). */
export interface TeamRecord {
    played: number
    won: number
    drawn: number
    lost: number
    goalsFor: number
    goalsAgainst: number
    /** goalsFor − goalsAgainst. */
    goalDiff: number
}

/** One team's contribution to an entry: its record + the points it earned. */
export interface TeamContribution {
    team: WcTeam
    record: TeamRecord
    points: number
}

/** A participant with their drawn teams + computed standing. */
export interface LeaderboardRow {
    entry: WcSweepstakeEntry
    teams: WcTeam[]
    points: number
    /** Aggregate record summed across all of the entry's teams. */
    record: TeamRecord
    /** Per-team contribution, sorted highest points first. Drives the podium
     *  flags-behind-the-name sizing (bigger contributor, bigger flag). */
    contributions: TeamContribution[]
    /** True once every one of the entry's teams is eliminated. */
    knockedOut: boolean
    /** True if the entry holds the champion. */
    hasChampion: boolean
}
