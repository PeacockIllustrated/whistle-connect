import { Trophy } from 'lucide-react'
import type { LeaderboardRow } from '@/lib/world-cup/types'
import { TeamPill } from './TeamBits'
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
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
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
                <div className="flex flex-wrap gap-1.5">
                    {row.teams.length === 0 ? (
                        <span className="text-xs text-[var(--foreground-muted)]">No teams drawn yet</span>
                    ) : (
                        row.teams.map((t) => <TeamPill key={t.code} team={t} />)
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
