import Link from 'next/link'

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[var(--background)]">
            {/* Header */}
            <header className="bg-[var(--brand-navy)] border-b border-white/10">
                <div className="max-w-[var(--content-max-width)] mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] flex items-center justify-center shadow-lg shadow-[var(--brand-primary)]/30">
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white tracking-tight">Whistle Connect</h1>
                                <p className="text-[10px] text-white/50 uppercase tracking-widest font-medium">Grassroots Football</p>
                            </div>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-[var(--content-max-width)] mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Terms of Service</h1>
                    <p className="text-[var(--foreground-muted)]">Last updated: {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
                </div>

                <div className="space-y-8 text-[var(--foreground)]">
                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">1. Acceptance of Terms</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            By accessing or using the Whistle Connect application, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, then you may not access the service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">2. User Accounts</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed mb-4">
                            When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                        </p>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            You are responsible for protecting your own password and account access. You agree not to disclose your password to any third party.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">3. Content and Conduct</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, videos, or other material (&quot;Content&quot;). You are responsible for the Content that you post to the Service, including its legality, reliability, and appropriateness.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">4. Match Bookings and Payments</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            Whistle Connect acts as a platform to connect coaches and referees. We facilitate the booking process but are not a party to the actual contract for match officiating. Any disputes regarding match conduct or fees must be resolved between the coach and referee directly, though we may provide assistance where possible.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">5. Termination</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold mb-3 text-[var(--brand-navy)]">6. Changes</h2>
                        <p className="text-[var(--neutral-600)] leading-relaxed">
                            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
                        </p>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="mt-12 py-8 border-t border-[var(--border-color)] bg-white">
                <div className="max-w-[var(--content-max-width)] mx-auto px-4 text-center">
                    <p className="text-sm text-[var(--foreground-muted)]">
                        &copy; {new Date().getFullYear()} Whistle Connect
                    </p>
                    <div className="flex justify-center gap-4 mt-3">
                        <Link href="/privacy" className="text-xs text-[var(--foreground-subtle)] hover:text-[var(--foreground)]">
                            Privacy
                        </Link>
                        <Link href="/terms" className="text-xs font-semibold text-[var(--brand-navy)] hover:text-[var(--brand-primary)]">
                            Terms
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
