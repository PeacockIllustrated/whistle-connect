import { Crown, Trophy } from 'lucide-react'
import type { LeaderboardRow } from '@/lib/world-cup/types'
import { TeamPill, FlagImage } from './TeamBits'
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

/** Flag height scaled by a team's share of the player's points. When nobody has
 *  scored yet (max 0), every flag shows at a uniform small size. */
function flagHeight(points: number, max: number): number {
    if (max <= 0) return 14
    return Math.round(13 + (points / max) * 17) // 13..30px
}

/** Top-3 podium. Order on screen: 2 · 1 · 3 so the leader sits centre + tallest.
 *  Each player's flags sit behind their name, growing with how much that team
 *  contributes to their total. */
function Podium({ rows }: { rows: LeaderboardRow[] }) {
    const order = [rows[1], rows[0], rows[2]]
    const place = [2, 1, 3]
    return (
        <div className="mb-6 grid grid-cols-3 items-end gap-2 sm:gap-3">
            {order.map((row, i) => {
                if (!row) return <div key={i} />
                const p = place[i]
                const leader = p === 1
                const max = row.contributions[0]?.points ?? 0
                const backdrop = row.contributions.slice(0, 5)
                return (
                    <div key={row.entry.id} className="flex flex-col items-center wc-rise" style={{ animationDelay: `${i * 80}ms` }}>
                        {leader && <Crown className="mb-1 h-6 w-6 text-amber-400" />}
                        <div
                            className={cn(
                                'relative w-full overflow-hidden rounded-2xl bg-white px-2 py-3 text-center',
                                leader ? 'border-2 border-[var(--wc-red)] shadow-lg' : 'border border-[var(--border-color)] shadow-sm',
                            )}
                        >
                            {backdrop.length > 0 && (
                                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2 flex items-end justify-center gap-[3px] opacity-30">
                                    {backdrop.map((c) => (
                                        <FlagImage key={c.team.code} countryCode={c.team.country_code} code={c.team.code} height={flagHeight(c.points, max)} />
                                    ))}
                                </div>
                            )}

                            <div className="relative z-10 flex flex-col items-center">
                                <span
                                    className={cn(
                                        'flex items-center justify-center rounded-full bg-gradient-to-br text-white font-bold',
                                        MEDAL[p - 1],
                                        leader ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm',
                                    )}
                                >
                                    {initials(row.entry.participant_name)}
                                </span>
                                <span className="mt-2 line-clamp-1 max-w-full rounded bg-white/75 px-1 text-xs font-bold text-[var(--foreground)]">
                                    {row.entry.participant_name}
                                </span>
                                <span className="mt-0.5 rounded bg-white/75 px-1 text-lg font-extrabold leading-none text-[var(--foreground)]">{row.points}</span>
                                <span className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)]">pts</span>
                            </div>
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
