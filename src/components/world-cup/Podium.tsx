'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { Crown } from 'lucide-react'
import type { LeaderboardRow } from '@/lib/world-cup/types'
import { FlagImage, formatGoalDiff } from './TeamBits'
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
const PLINTH_H = ['h-28 sm:h-36', 'h-20 sm:h-24', 'h-16 sm:h-20']

/** Signed fan slot per contribution index: 0, +1, -1, +2, -2 (biggest centre). */
function slotForIndex(i: number): number {
    if (i === 0) return 0
    return i % 2 === 1 ? Math.ceil(i / 2) : -Math.ceil(i / 2)
}

const fanContainer: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}
const fanItem: Variants = {
    hidden: { opacity: 0, y: 16, scale: 0.8 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } },
}

/** A player's drawn-team flags, fanned out and sized by point contribution. */
function FlagFan({ row, leader }: { row: LeaderboardRow; leader: boolean }) {
    const items = row.contributions.slice(0, 5)
    if (items.length === 0) return <div className="h-14 sm:h-16" />

    const max = items[0]?.points ?? 0
    const base = leader ? 26 : 20
    const range = leader ? 30 : 20

    // Render left-to-right ordered by slot so the biggest sits centre + front.
    const arranged = items
        .map((c, i) => ({ c, slot: slotForIndex(i), i }))
        .sort((a, b) => a.slot - b.slot)

    return (
        <motion.div
            variants={fanContainer}
            initial="hidden"
            animate="show"
            className="relative flex h-[68px] w-full items-end justify-center sm:h-[84px]"
        >
            {arranged.map(({ c, slot, i }, idx) => {
                const share = max > 0 ? c.points / max : slot === 0 ? 1 : 0.5
                const h = Math.round(base + share * range)
                const rot = slot * 13
                const z = 12 - Math.abs(slot)
                const elim = c.team.eliminated
                return (
                    <motion.span
                        key={c.team.code}
                        variants={fanItem}
                        className="relative block"
                        style={{ zIndex: z, marginLeft: idx === 0 ? 0 : -Math.round(h * 0.45) }}
                    >
                        <span
                            className={cn(
                                'block origin-bottom overflow-hidden rounded-[3px] shadow-[0_4px_10px_rgba(0,0,0,0.4)] ring-1 ring-white/30 transition',
                                elim && 'grayscale brightness-90 opacity-45 ring-white/10',
                            )}
                            style={{ transform: `rotate(${rot}deg)`, lineHeight: 0 }}
                        >
                            <FlagImage countryCode={c.team.country_code} code={c.team.code} height={h} />
                        </span>
                        {i === 0 && c.team.stage === 'champion' && (
                            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px]">
                                <Crown className="h-2.5 w-2.5 text-[var(--wc-ink)]" />
                            </span>
                        )}
                    </motion.span>
                )
            })}
        </motion.div>
    )
}

function Confetti() {
    const reduce = useReducedMotion()
    if (reduce) return null
    const bits = [
        { x: '12%', c: '#cd1719', d: 0 }, { x: '24%', c: '#f6c453', d: 0.3 },
        { x: '38%', c: '#ffffff', d: 0.6 }, { x: '52%', c: '#44418a', d: 0.15 },
        { x: '66%', c: '#f6c453', d: 0.45 }, { x: '78%', c: '#cd1719', d: 0.9 },
        { x: '88%', c: '#ffffff', d: 0.7 }, { x: '46%', c: '#34d399', d: 1.05 },
    ]
    return (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 overflow-hidden">
            {bits.map((b, i) => (
                <motion.span
                    key={i}
                    className="absolute top-0 h-2 w-1.5 rounded-[1px]"
                    style={{ left: b.x, background: b.c }}
                    initial={{ y: -12, opacity: 0, rotate: 0 }}
                    animate={{ y: 96, opacity: [0, 1, 1, 0], rotate: 220 }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: b.d, ease: 'easeIn' }}
                />
            ))}
        </div>
    )
}

function PodiumPlayer({ row, place }: { row: LeaderboardRow; place: number }) {
    const reduce = useReducedMotion()
    const leader = place === 1

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24, delay: place === 1 ? 0 : place * 0.07 }}
            className="relative flex flex-col items-center"
        >
            {leader && <Confetti />}

            {leader && (
                <motion.div
                    animate={reduce ? {} : { y: [0, -3, 0], rotate: [-6, 6, -6] }}
                    transition={reduce ? {} : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                    className="mb-1"
                >
                    <Crown className="h-7 w-7 text-amber-400 drop-shadow-[0_2px_6px_rgba(246,196,83,0.6)]" />
                </motion.div>
            )}

            <FlagFan row={row} leader={leader} />

            <div className="relative z-30 -mt-2 flex flex-col items-center">
                {leader && (
                    <motion.span
                        aria-hidden
                        className="absolute -inset-3 rounded-full bg-[var(--wc-red)] blur-xl"
                        animate={reduce ? { opacity: 0.35 } : { opacity: [0.25, 0.5, 0.25] }}
                        transition={reduce ? {} : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                )}
                <span
                    className={cn(
                        'relative z-10 flex items-center justify-center rounded-full bg-gradient-to-br font-extrabold text-[var(--wc-ink)]',
                        MEDAL[place - 1],
                        leader
                            ? 'h-16 w-16 text-xl shadow-[0_0_0_3px_var(--wc-red)]'
                            : 'h-12 w-12 text-base shadow-lg',
                    )}
                >
                    {initials(row.entry.participant_name)}
                </span>
            </div>

            <div className="relative z-10 mt-2 flex flex-col items-center text-center">
                <span className={cn('line-clamp-1 max-w-[88px] font-bold text-white sm:max-w-[120px]', leader ? 'text-sm' : 'text-xs')}>
                    {row.entry.participant_name}
                </span>
                <span className={cn('font-extrabold leading-none text-white', leader ? 'text-2xl' : 'text-lg')}>{row.points}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/45">pts</span>
                {row.record.played > 0 && (
                    <span className="mt-0.5 text-[10px] font-semibold tabular-nums text-white/55">
                        {row.record.won}W·{row.record.drawn}D·{row.record.lost}L · GD {formatGoalDiff(row.record.goalDiff)}
                    </span>
                )}
            </div>

            <div
                className={cn(
                    'relative mt-2 flex w-full items-center justify-center overflow-hidden rounded-t-xl bg-gradient-to-b',
                    PLINTH_H[place - 1],
                    leader ? 'wc-sheen from-[var(--wc-blue)] to-[var(--wc-ink)] ring-1 ring-[var(--wc-red)]/40' : 'from-[var(--brand-primary-light)] to-[var(--wc-ink)]',
                )}
            >
                <span className={cn('wc-display text-white', leader ? 'text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl')}>{place}</span>
            </div>
        </motion.div>
    )
}

/** Top-3 podium on a navy stage. Order on screen: 2 · 1 · 3 so the leader sits
 *  centre and tallest, with each player's flags fanned out and sized by their
 *  point contribution. */
export function Podium({ rows }: { rows: LeaderboardRow[] }) {
    const order: [LeaderboardRow | undefined, number][] = [
        [rows[1], 2],
        [rows[0], 1],
        [rows[2], 3],
    ]
    return (
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-[var(--wc-ink)] p-4 pt-6 shadow-lg sm:p-6">
            <div className="absolute inset-0 wc-pitch-grid opacity-40" aria-hidden />
            <div
                className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[var(--wc-red)] opacity-20 blur-3xl"
                aria-hidden
            />
            <div className="relative grid grid-cols-3 items-end gap-1.5 sm:gap-4">
                {order.map(([row, place]) =>
                    row ? <PodiumPlayer key={row.entry.id} row={row} place={place} /> : <div key={place} />,
                )}
            </div>
        </div>
    )
}
