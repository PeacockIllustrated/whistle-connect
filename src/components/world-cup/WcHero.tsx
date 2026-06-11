'use client'

import Link from 'next/link'
import { motion, type Variants } from 'framer-motion'
import { Trophy, Shuffle, BarChart3, ArrowRight } from 'lucide-react'
import { NationsTicker } from './NationsTicker'

const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
}
const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
}

export function WcHero({ champion }: { champion?: string | null }) {
    return (
        <section className="relative overflow-hidden bg-[var(--wc-ink)] text-white">
            {/* Texture + glow layers */}
            <div className="absolute inset-0 wc-pitch-grid opacity-60" aria-hidden />
            <div className="absolute inset-0 wc-stripes opacity-40" aria-hidden />
            <motion.div
                aria-hidden
                className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[var(--wc-red)] opacity-30 blur-3xl"
                animate={{ y: [0, 20, 0], opacity: [0.25, 0.4, 0.25] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                aria-hidden
                className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[var(--brand-primary-light)] opacity-30 blur-3xl"
                animate={{ y: [0, -24, 0], opacity: [0.2, 0.35, 0.2] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            />

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="relative mx-auto w-full max-w-4xl px-4 pt-14 pb-10 sm:pt-20 sm:pb-14"
            >
                <motion.span
                    variants={item}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur"
                >
                    <Trophy className="h-3.5 w-3.5 text-amber-300" /> Canada · Mexico · USA 2026
                </motion.span>

                <motion.h1 variants={item} className="wc-display mt-6">
                    <span className="block text-2xl sm:text-3xl text-white/85 tracking-[0.04em]">The Whistle Connect</span>
                    <span className="wc-gradient-text mt-1 block text-6xl sm:text-8xl">World Cup</span>
                    <span className="mt-3 inline-block bg-[var(--wc-red)] px-3 py-1 text-xl sm:text-3xl text-white">
                        Sweepstake &amp; Tracker
                    </span>
                </motion.h1>

                <motion.p variants={item} className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-white/75">
                    Draw all 48 nations out to your mates, watch a live points leaderboard
                    climb to the final, and share it with one link. Free, no catch, from
                    Whistle Connect.
                </motion.p>

                <motion.div variants={item} className="mt-6 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
                    <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">48 Nations</span>
                    <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">104 Matches</span>
                    <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">1 Trophy</span>
                </motion.div>

                <motion.div variants={item} className="mt-8 flex flex-col sm:flex-row gap-3">
                    <Link
                        href="/world-cup/sweepstake"
                        className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[var(--wc-red)] px-7 py-4 text-base font-extrabold text-white shadow-[0_10px_30px_-8px_rgba(205,23,25,0.7)] transition-transform hover:-translate-y-0.5"
                    >
                        <Shuffle className="h-5 w-5" /> Run a sweepstake
                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                    <Link
                        href="/world-cup/tracker"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-7 py-4 text-base font-extrabold text-white backdrop-blur transition-colors hover:bg-white/15"
                    >
                        <BarChart3 className="h-5 w-5" /> Follow the tracker
                    </Link>
                </motion.div>

                {champion && (
                    <motion.div
                        variants={item}
                        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-amber-400/15 px-4 py-2.5 text-sm font-bold text-amber-200 ring-1 ring-amber-300/30"
                    >
                        <Trophy className="h-4 w-4" /> Champions: {champion}
                    </motion.div>
                )}
            </motion.div>

            <div className="relative">
                <NationsTicker tone="dark" />
            </div>
        </section>
    )
}
