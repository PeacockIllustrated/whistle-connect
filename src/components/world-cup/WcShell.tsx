import Image from 'next/image'
import Link from 'next/link'

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

            <footer className="border-t border-[var(--border-color)] bg-[var(--background-soft)]">
                <div className="max-w-[var(--content-max-width)] mx-auto w-full px-4 py-6 text-center text-sm text-[var(--foreground-muted)]">
                    <p>
                        A free tool from{' '}
                        <Link href="/" className="font-semibold text-[var(--brand-primary)] hover:underline">
                            Whistle Connect
                        </Link>{' '}
                        — grassroots referee bookings made simple.
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-4 text-xs">
                        <Link href="/terms" className="hover:underline">Terms</Link>
                        <Link href="/privacy" className="hover:underline">Privacy</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
