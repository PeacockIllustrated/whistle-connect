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

const MEDAL = ['from-amber-300 to-amber-500', 'from-slate-200 to-slate-400', 'from-orange-300 to-orange-500']
const STEP_H = ['h-24 sm:h-28', 'h-16 sm:h-20', 'h-12 sm:h-16']

/** Top-3 podium. Order on screen: 2 · 1 · 3 so the leader sits centre + tallest. */
function Podium({ rows }: { rows: LeaderboardRow[] }) {
    const order = [rows[1], rows[0], rows[2]]
    const place = [2, 1, 3]
    return (
        <div className="mb-6 grid grid-cols-3 items-end gap-2 sm:gap-3">
            {order.map((row, i) => {
                if (!row) return <div key={i} />
                const p = place[i]
                const leader = p === 1
                return (
                    <div key={row.entry.id} className="flex flex-col items-center wc-rise" style={{ animationDelay: `${i * 80}ms` }}>
                        {leader && <Crown className="mb-1 h-6 w-6 text-amber-400" />}
                        <div
                            className={cn(
                                'flex flex-col items-center rounded-2xl bg-white px-2 py-3 text-center w-full',
                                leader ? 'border-2 border-[var(--wc-red)] shadow-lg' : 'border border-[var(--border-color)] shadow-sm',
                            )}
                        >
                            <span
                                className={cn(
                                    'flex items-center justify-center rounded-full bg-gradient-to-br text-white font-bold',
                                    MEDAL[p - 1],
                                    leader ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm',
                                )}
                            >
                                {initials(row.entry.participant_name)}
                            </span>
                            <span className="mt-2 line-clamp-1 max-w-full text-xs font-bold text-[var(--foreground)]">
                                {row.entry.participant_name}
                            </span>
                            <span className="mt-0.5 text-lg font-extrabold leading-none text-[var(--foreground)]">{row.points}</span>
                            <span className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)]">pts</span>
                        </div>
                        <div
                            className={cn(
                                'mt-2 flex w-full items-center justify-center rounded-t-lg bg-gradient-to-b text-white',
                                STEP_H[p - 1],
                                leader ? 'from-[var(--wc-ink)] to-[var(--wc-blue)]' : 'from-[var(--brand-primary-light)] to-[var(--wc-ink)]',
                            )}
                        >
                            <span className="wc-display text-3xl sm:text-4xl">{p}</span>
                        </div>
                    </div>
                )
            })}
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
