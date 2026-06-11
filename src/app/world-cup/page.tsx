import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight, Shuffle, BarChart3, Users, Share2, ArrowRight } from 'lucide-react'
import { WcShell } from '@/components/world-cup/WcShell'
import { WcHero } from '@/components/world-cup/WcHero'
import { getChampion } from '@/lib/world-cup/data'

export const metadata: Metadata = {
    title: 'World Cup 2026 Sweepstake & Tracker | Whistle Connect',
    description:
        'Run a free World Cup 2026 sweepstake or follow every group and knockout match. Draw teams to your friends, track a live leaderboard, share with the group — from Whistle Connect.',
}

export default async function WorldCupLandingPage() {
    const champion = await getChampion()

    return (
        <WcShell>
            <WcHero champion={champion?.name ?? null} />

            {/* Two ways to play */}
            <section className="mx-auto w-full max-w-4xl px-4 py-12">
                <h2 className="wc-display text-center text-3xl sm:text-4xl text-[var(--foreground)]">Two ways to play</h2>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <Link
                        href="/world-cup/sweepstake"
                        className="group relative overflow-hidden rounded-3xl border border-[var(--border-color)] bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-xl"
                    >
                        <span className="absolute inset-x-0 top-0 h-1.5 bg-[var(--wc-red)]" />
                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--wc-red)] to-[#a31214] text-white shadow-lg">
                            <Shuffle className="h-7 w-7" />
                        </span>
                        <h3 className="wc-display mt-5 flex items-center gap-1 text-2xl text-[var(--foreground)]">
                            Sweepstake
                            <ChevronRight className="h-6 w-6 text-[var(--wc-red)] transition-transform group-hover:translate-x-1" />
                        </h3>
                        <p className="mt-2 text-[var(--foreground-muted)]">
                            Add your players, hit draw, and all 48 teams are dealt out at random.
                            A live points leaderboard keeps everyone hooked to the final whistle.
                        </p>
                    </Link>

                    <Link
                        href="/world-cup/tracker"
                        className="group relative overflow-hidden rounded-3xl border border-[var(--border-color)] bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-xl"
                    >
                        <span className="absolute inset-x-0 top-0 h-1.5 bg-[var(--wc-ink)]" />
                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--wc-ink)] to-[var(--wc-blue)] text-white shadow-lg">
                            <BarChart3 className="h-7 w-7" />
                        </span>
                        <h3 className="wc-display mt-5 flex items-center gap-1 text-2xl text-[var(--foreground)]">
                            Tracker
                            <ChevronRight className="h-6 w-6 text-[var(--wc-ink)] transition-transform group-hover:translate-x-1" />
                        </h3>
                        <p className="mt-2 text-[var(--foreground-muted)]">
                            All 12 groups, every result and the full knockout bracket — no account
                            needed. Just follow the tournament as it unfolds.
                        </p>
                    </Link>
                </div>
            </section>

            {/* How it works */}
            <section className="bg-[var(--background-soft)] border-y border-[var(--border-color)]">
                <div className="mx-auto w-full max-w-4xl px-4 py-12">
                    <h2 className="wc-display text-center text-3xl sm:text-4xl text-[var(--foreground)]">How it works</h2>
                    <div className="mt-9 grid gap-8 sm:grid-cols-3">
                        {[
                            { n: '01', icon: Users, title: 'Add your players', body: 'Name everyone — the office, the family, the team WhatsApp.' },
                            { n: '02', icon: Shuffle, title: 'Draw the teams', body: 'All 48 nations are dealt out evenly and at random.' },
                            { n: '03', icon: Share2, title: 'Share the link', body: 'Everyone follows the live leaderboard. No sign-up to watch.' },
                        ].map((s) => (
                            <div key={s.n} className="relative">
                                <span className="wc-display text-5xl text-[var(--wc-red)]/15">{s.n}</span>
                                <span className="mt-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--wc-ink)] text-white">
                                    <s.icon className="h-5 w-5" />
                                </span>
                                <h3 className="mt-3 font-bold text-[var(--foreground)]">{s.title}</h3>
                                <p className="mt-1 text-sm text-[var(--foreground-muted)]">{s.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Closing CTA */}
            <section className="relative overflow-hidden bg-[var(--wc-ink)] text-white">
                <div className="absolute inset-0 wc-stripes opacity-30" aria-hidden />
                <div className="relative mx-auto w-full max-w-4xl px-4 py-12 text-center">
                    <h2 className="wc-display text-3xl sm:text-5xl">Set yours up in 60 seconds</h2>
                    <p className="mx-auto mt-3 max-w-md text-white/75">
                        No payment, no faff. Create your sweepstake and send the link before kick-off.
                    </p>
                    <Link
                        href="/world-cup/sweepstake"
                        className="group mt-7 inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--wc-red)] px-8 py-4 text-base font-extrabold text-white shadow-[0_10px_30px_-8px_rgba(205,23,25,0.7)] transition-transform hover:-translate-y-0.5"
                    >
                        Run a sweepstake <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>
            </section>
        </WcShell>
    )
}
