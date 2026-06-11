import { Crown, Trophy } from 'lucide-react'
import type { LeaderboardRow } from '@/lib/world-cup/types'
import { TeamPill } from './TeamBits'
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

export function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
    return (
        <ol className="space-y-2">
            {rows.map((row, i) => {
                const leader = i === 0 && row.points > 0 && !row.knockedOut
                return (
                    <li
                        key={row.entry.id}
                        className={cn(
                            'flex items-center gap-3 rounded-[var(--radius-lg)] bg-white p-3 sm:p-4',
                            leader
                                ? 'border-2 border-[var(--wc-blue)] shadow-md'
                                : 'border border-[var(--border-color)]',
                        )}
                    >
                        <span className="w-5 shrink-0 text-center text-sm font-semibold text-[var(--foreground-muted)]">
                            {i + 1}
                        </span>

                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--background-soft)] text-xs font-bold text-[var(--foreground-muted)]">
                            {initials(row.entry.participant_name)}
                        </span>

                        <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                <span
                                    className={cn(
                                        'text-sm font-semibold',
                                        row.knockedOut ? 'text-[var(--foreground-muted)]' : 'text-[var(--foreground)]',
                                    )}
                                >
                                    {row.entry.participant_name}
                                </span>
                                {leader && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wc-blue)] px-2 py-0.5 text-[11px] font-semibold text-white">
                                        <Crown className="h-3 w-3" /> Leader
                                    </span>
                                )}
                                {row.hasChampion && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                        <Trophy className="h-3 w-3" /> Champion
                                    </span>
                                )}
                                {row.knockedOut && !row.hasChampion && (
                                    <span className="text-[11px] text-[var(--foreground-muted)]">knocked out</span>
                                )}
                                {row.entry.claimed_by && (
                                    <span className="text-[11px] text-emerald-600">claimed</span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {row.teams.length === 0 ? (
                                    <span className="text-xs text-[var(--foreground-muted)]">No teams drawn yet</span>
                                ) : (
                                    row.teams.map((t) => <TeamPill key={t.code} team={t} />)
                                )}
                            </div>
                        </div>

                        <div className="shrink-0 text-right">
                            <div className="text-2xl font-bold leading-none text-[var(--foreground)]">{row.points}</div>
                            <div className="text-[11px] text-[var(--foreground-muted)]">pts</div>
                        </div>
                    </li>
                )
            })}
        </ol>
    )
}
