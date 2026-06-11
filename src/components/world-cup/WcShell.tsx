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
            <header className="bg-[var(--wc-ink)] text-white">
                <div className="h-1 bg-[var(--wc-red)]" />
                <div className="max-w-[var(--content-max-width)] mx-auto w-full px-4 py-3 flex items-center justify-between">
                    <Link href="/world-cup" className="flex items-center gap-3">
                        <Image src="/assets/logo-main-white.svg" alt="Whistle Connect" width={128} height={44} priority />
                    </Link>
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/55">
                        World Cup 2026
                    </span>
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
