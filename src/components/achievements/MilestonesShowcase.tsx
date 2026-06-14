'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Lock, Sparkles } from 'lucide-react'
import type { Milestone } from '@/lib/achievements'
import { badgeIcon, TIER_GRAD, TIER_GLOW, TIER_NAME } from './tiers'

// ─────────────────────────────────────────────────────────────────────────────
// Milestones — one-off "trophy" badges. Minted gold-foil look when earned, an
// embossed un-minted coin when locked, with a fluid hover/tap popover. Client
// component so the medallions can breathe (sheen, lift, spring entrance).
// ─────────────────────────────────────────────────────────────────────────────

function MedallionFace({ m, reduce }: { m: Milestone; reduce: boolean }) {
    const grad = TIER_GRAD[m.tier]
    const glow = TIER_GLOW[m.tier]

    if (!m.earned) {
        // Un-minted coin — embossed, the icon faintly pressed in. Not a flat tile.
        return (
            <span
                className="relative flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                    background: 'linear-gradient(160deg,#f4f7fb,#e2e8f1)',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -4px 7px rgba(148,163,184,0.4), 0 4px 10px -6px rgba(15,23,42,0.3)',
                }}
            >
                <span aria-hidden className="absolute inset-[3px] rounded-full border border-white/60" />
                {badgeIcon(m.icon, { className: 'relative h-7 w-7', color: '#aab4c2', strokeWidth: 2 })}
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#cdd6e2] shadow">
                    <Lock className="h-2.5 w-2.5 text-white" strokeWidth={2.6} />
                </span>
            </span>
        )
    }

    return (
        <span
            className="relative flex h-16 w-16 items-center justify-center rounded-full"
            style={{
                background: grad,
                boxShadow: `0 8px 18px -5px ${glow}cc, inset 0 2px 3px rgba(255,255,255,0.6), inset 0 -4px 7px rgba(0,0,0,0.2)`,
            }}
        >
            {/* top gloss */}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ background: 'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.65), rgba(255,255,255,0) 55%)' }}
            />
            {/* engraved inner ring */}
            <span aria-hidden className="absolute inset-[3px] rounded-full border border-white/40" />
            {/* travelling sheen */}
            {!reduce && (
                <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                    <span
                        className="absolute top-0 bottom-0 left-0 w-1/3"
                        style={{
                            background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.85),transparent)',
                            animation: 'wc-sheen 3.6s ease-in-out infinite',
                        }}
                    />
                </span>
            )}
            {badgeIcon(m.icon, { className: 'relative h-7 w-7 drop-shadow-sm', color: '#ffffff', strokeWidth: 2.2 })}
            {/* award seal */}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow">
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </span>
        </span>
    )
}

function MilestoneCoin({
    m, index, open, onToggle, onHover, reduce,
}: {
    m: Milestone
    index: number
    open: boolean
    onToggle: () => void
    onHover: (v: boolean) => void
    reduce: boolean
}) {
    const glow = TIER_GLOW[m.tier]

    return (
        <div className="relative flex w-[92px] flex-col items-center">
            <AnimatePresence>
                {open && (
                    <motion.div
                        role="tooltip"
                        initial={{ opacity: 0, y: 6, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 440, damping: 30 }}
                        className="absolute bottom-full left-1/2 z-30 mb-2.5 w-[184px] -translate-x-1/2"
                    >
                        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--background)] p-3 text-left shadow-xl">
                            <div className="flex items-center gap-2">
                                <span className="text-[12.5px] font-bold leading-tight">{m.name}</span>
                                <span
                                    className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                                    style={{
                                        color: m.earned ? '#fff' : glow,
                                        background: m.earned ? glow : 'transparent',
                                        border: m.earned ? 'none' : `1px solid ${glow}66`,
                                    }}
                                >
                                    {m.earned ? 'Earned' : 'Locked'}
                                </span>
                            </div>
                            <p className="mt-1 text-[11px] leading-snug text-[var(--foreground-muted)]">
                                {m.earned ? m.description : `Locked — ${m.description.charAt(0).toLowerCase()}${m.description.slice(1)}.`}
                            </p>
                            <div className="mt-2 flex items-center gap-1 text-[10.5px] font-bold" style={{ color: glow }}>
                                <Sparkles className="h-3 w-3" /> +{m.xp} XP · {TIER_NAME[m.tier]}
                            </div>
                        </div>
                        <span
                            aria-hidden
                            className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-[var(--border-color)] bg-[var(--background)]"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                type="button"
                aria-label={`${m.name}: ${m.earned ? 'earned' : 'locked'}. ${m.description}. ${m.xp} XP.`}
                aria-expanded={open}
                onClick={onToggle}
                onHoverStart={() => onHover(true)}
                onHoverEnd={() => onHover(false)}
                onFocus={() => onHover(true)}
                onBlur={() => onHover(false)}
                initial={reduce ? false : { opacity: 0, y: 16, scale: 0.78 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: reduce ? 0 : 0.06 * index, type: 'spring', stiffness: 280, damping: 18 }}
                whileHover={reduce ? undefined : { y: -5, scale: 1.07 }}
                whileTap={{ scale: 0.93 }}
                className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
            >
                {m.earned && !reduce && (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-xl"
                        style={{ background: glow, opacity: 0.32 }}
                    />
                )}
                <MedallionFace m={m} reduce={reduce} />
            </motion.button>

            <div className={`mt-2 text-center text-[11px] font-bold leading-tight ${m.earned ? '' : 'text-[var(--foreground-muted)]'}`}>
                {m.name}
            </div>
            <div
                className="text-[9px] font-semibold uppercase tracking-wide"
                style={{ color: m.earned ? glow : 'var(--foreground-subtle)' }}
            >
                {m.earned ? `${TIER_NAME[m.tier]} · +${m.xp}` : 'Locked'}
            </div>
        </div>
    )
}

export function MilestonesShowcase({ items }: { items: Milestone[] }) {
    const [open, setOpen] = useState<string | null>(null)
    const ref = useRef<HTMLElement>(null)
    const reduce = useReducedMotion()

    useEffect(() => {
        if (!open) return
        const onDown = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null)
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
        document.addEventListener('pointerdown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointerdown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    if (!items.length) return null
    const earned = items.filter((m) => m.earned).length

    return (
        <section ref={ref}>
            <div className="flex items-center gap-2 pt-6 pb-3">
                <span className="h-4 w-1 rounded-full bg-[var(--wc-red)]" />
                <h2 className="text-sm font-bold">Milestones</h2>
                <span className="ml-auto text-[11px] font-semibold text-[var(--foreground-muted)]">
                    {earned} of {items.length} earned
                </span>
            </div>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-4 rounded-2xl border border-[var(--border-color)] bg-[var(--background-elevated)] p-5 shadow-sm">
                {items.map((m, i) => (
                    <MilestoneCoin
                        key={m.key}
                        m={m}
                        index={i}
                        open={open === m.key}
                        onToggle={() => setOpen((o) => (o === m.key ? null : m.key))}
                        onHover={(v) => setOpen((o) => (v ? m.key : o === m.key ? null : o))}
                        reduce={!!reduce}
                    />
                ))}
            </div>
        </section>
    )
}
