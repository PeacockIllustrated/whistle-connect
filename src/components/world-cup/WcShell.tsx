import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ShieldCheck } from 'lucide-react'

/**
 * Branded public wrapper for every /world-cup page. Whistle Connect navy header
 * + red accent, no app chrome (these pages are open to everyone, signed in or
 * not).
 */
export function WcShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
            <header className="sticky top-0 z-40 bg-[var(--wc-ink)]/95 text-white backdrop-blur supports-[backdrop-filter]:bg-[var(--wc-ink)]/80">
                <div className="h-1 bg-[var(--wc-red)]" />
                <div className="mx-auto w-full max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
                    <Link href="/world-cup" className="flex items-center gap-2.5">
                        <Image src="/assets/logo-main-white.svg" alt="Whistle Connect" width={120} height={42} priority />
                        <span className="hidden sm:inline wc-display text-sm leading-none text-white/55">World Cup</span>
                    </Link>
                    <nav className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
                        <Link href="/world-cup/tracker" className="rounded-full px-3 py-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                            Tracker
                        </Link>
                        <Link href="/world-cup/sweepstake" className="rounded-full bg-[var(--wc-red)] px-3 py-1.5 text-white transition-transform hover:-translate-y-0.5">
                            Sweepstake
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="flex-1 w-full">{children}</main>

            <footer className="relative overflow-hidden bg-[var(--wc-ink)] text-white">
                <div className="absolute inset-0 wc-stripes opacity-20" aria-hidden />
                <div className="relative mx-auto w-full max-w-4xl px-4 py-10">
                    <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="max-w-md">
                            <Image src="/assets/logo-main-white.svg" alt="Whistle Connect" width={150} height={52} className="h-12 w-auto" />
                            <p className="mt-3 text-sm leading-relaxed text-white/75">
                                Whistle Connect is the FA-partnered app for booking qualified grassroots
                                referees in seconds. This World Cup tool is a free gift from our team to yours.
                            </p>
                            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
                                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                                <span className="text-xs font-semibold text-white/80">In partnership with The FA</span>
                            </div>
                        </div>

                        <Link
                            href="/"
                            className="group inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[var(--wc-red)] px-6 py-3.5 font-extrabold text-white shadow-[0_10px_30px_-8px_rgba(205,23,25,0.7)] transition-transform hover:-translate-y-0.5"
                        >
                            Explore Whistle Connect
                            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </div>

                    <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-white/55 sm:flex-row">
                        <span>© Whistle Connect. Grassroots referee bookings made simple.</span>
                        <div className="flex items-center gap-4">
                            <Link href="/terms" className="hover:text-white hover:underline">Terms</Link>
                            <Link href="/privacy" className="hover:text-white hover:underline">Privacy</Link>
                            <Link href="/" className="hover:text-white hover:underline">Main app</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}
