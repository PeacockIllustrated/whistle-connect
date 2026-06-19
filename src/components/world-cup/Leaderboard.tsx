import { Trophy, Medal } from 'lucide-react'
import type { LeaderboardRow } from '@/lib/world-cup/types'
import { sweepstakeWinners } from '@/lib/world-cup/scoring'
import { TeamPill, formatGoalDiff } from './TeamBits'
import { Podium } from './Podium'
import { cn } from '@/lib/utils'

function initials(name: string): string {
    return name
        .split(/\s+/)
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
}

/** Compact "5W 2D 1L · GD +6" record summary. */
function RecordLine({ row }: { row: LeaderboardRow }) {
    const r = row.record
    if (r.played === 0) {
        return <span className="text-[11px] text-[var(--foreground-muted)]">No games played yet</span>
    }
    return (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--foreground-muted)] tabular-nums">
            <span><strong className="text-[var(--foreground)]">{r.won}</strong>W</span>
            <span><strong className="text-[var(--foreground)]">{r.drawn}</strong>D</span>
            <span><strong className="text-[var(--foreground)]">{r.lost}</strong>L</span>
            <span className="text-[var(--foreground-subtle)]">·</span>
            <span>GD <strong className="text-[var(--foreground)]">{formatGoalDiff(r.goalDiff)}</strong></span>
            <span className="text-[var(--foreground-subtle)]">·</span>
            <span>{r.goalsFor} GF</span>
        </span>
    )
}

/** The two headline winners: who holds the champion, and who leads on points. */
function Winners({ rows }: { rows: LeaderboardRow[] }) {
    const { pointsLeader, cupWinner, decided } = sweepstakeWinners(rows)
    if (!pointsLeader) return null

    return (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {/* Cup winner — whoever drew the champion team. */}
            <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                    <Trophy className="h-3.5 w-3.5" /> Cup winner
                </div>
                {cupWinner ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-lg font-extrabold text-[var(--foreground)]">
                            {cupWinner.entry.participant_name}
                        </span>
                        {cupWinner.contributions
                            .filter((c) => c.team.stage === 'champion')
                            .map((c) => <TeamPill key={c.team.code} team={c.team} showName />)}
                    </div>
                ) : (
                    <p className="mt-2 text-sm text-amber-800/80">Decided by the final — whoever holds the champions wins the cup.</p>
                )}
            </div>

            {/* Points winner / leader. */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-[var(--wc-ink)] p-4 text-white">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/55">
                    <Medal className="h-3.5 w-3.5" /> {decided ? 'Points winner' : 'Points leader'}
                </div>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-lg font-extrabold">{pointsLeader.entry.participant_name}</span>
                    <span>
                        <span className="text-2xl font-extrabold leading-none">{pointsLeader.points}</span>
                        <span className="ml-1 text-[11px] uppercase tracking-wider text-white/45">pts</span>
                    </span>
                </div>
            </div>
        </div>
    )
}

function Row({ row, rank }: { row: LeaderboardRow; rank: number }) {
    return (
        <li
            className={cn(
                'flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-white p-3 sm:p-4 wc-rise',
            )}
            style={{ animationDelay: `${Math.min(rank, 12) * 35}ms` }}
        >
            <span className="w-5 shrink-0 text-center text-sm font-bold text-[var(--foreground-muted)]">{rank}</span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--background-soft)] text-xs font-bold text-[var(--foreground-muted)]">
                {initials(row.entry.participant_name)}
            </span>
            <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={cn('text-sm font-semibold', row.knockedOut ? 'text-[var(--foreground-muted)]' : 'text-[var(--foreground)]')}>
                        {row.entry.participant_name}
                    </span>
                    {row.hasChampion && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            <Trophy className="h-3 w-3" /> Champion
                        </span>
                    )}
                    {row.knockedOut && !row.hasChampion && (
                        <span className="text-[11px] text-[var(--foreground-muted)]">knocked out</span>
                    )}
                    {row.entry.claimed_by && <span className="text-[11px] text-emerald-600">claimed</span>}
                </div>
                <div className="mb-1.5">
                    <RecordLine row={row} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {row.contributions.length === 0 ? (
                        <span className="text-xs text-[var(--foreground-muted)]">No teams drawn yet</span>
                    ) : (
                        row.contributions.map((c) => <TeamPill key={c.team.code} team={c.team} record={c.record} />)
                    )}
                </div>
            </div>
            <div className="shrink-0 text-right">
                <div className="text-2xl font-extrabold leading-none text-[var(--foreground)]">{row.points}</div>
                <div className="text-[11px] text-[var(--foreground-muted)]">pts</div>
            </div>
        </li>
    )
}

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
    const hasPodium = rows.length >= 3
    const listRows = hasPodium ? rows.slice(3) : rows

    return (
        <div>
            <Winners rows={rows} />
            {hasPodium && <Podium rows={rows} />}
            {listRows.length > 0 && (
                <ol className="space-y-2">
                    {listRows.map((row, i) => (
                        <Row key={row.entry.id} row={row} rank={(hasPodium ? 4 : 1) + i} />
                    ))}
                </ol>
            )}
        </div>
    )
}
