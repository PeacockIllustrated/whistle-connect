'use client'

import Link from 'next/link'
import { useConsent } from './ConsentProvider'

/**
 * Bottom-anchored cookie banner. Shown until the user makes a decision, or when
 * they re-open it via "Cookie settings". Accept and Reject are given equal
 * prominence (same size/position) per GDPR guidance — rejecting must be no
 * harder than accepting.
 */
export function CookieConsentBanner() {
    const { consent, ready, managerOpen, setConsent } = useConsent()

    // Don't render during SSR / before the cookie is read (prevents a flash for
    // users who already decided). Show when undecided or explicitly re-opened.
    if (!ready) return null
    if (consent !== null && !managerOpen) return null

    return (
        <div
            role="dialog"
            aria-label="Cookie consent"
            className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4"
        >
            <div className="max-w-[var(--content-max-width)] mx-auto bg-[var(--background)] border border-[var(--border-color)] rounded-2xl shadow-xl p-4 sm:p-5">
                <div className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-sm font-bold text-[var(--foreground)] mb-1">
                            Cookies on Whistle Connect
                        </h2>
                        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                            We use essential cookies to make the app work. With your permission we&apos;d
                            also use Google Analytics to see how the app is used so we can improve it.
                            Analytics cookies are optional and stay off unless you accept. Read more in our{' '}
                            <Link
                                href="/privacy"
                                className="text-[var(--color-primary)] font-medium hover:underline"
                            >
                                Privacy &amp; Cookie Policy
                            </Link>
                            .
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                        <button
                            type="button"
                            onClick={() => setConsent('denied')}
                            className="order-2 sm:order-1 px-5 py-2.5 rounded-xl text-sm font-bold border border-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--neutral-100)] transition-colors"
                        >
                            Reject analytics
                        </button>
                        <button
                            type="button"
                            onClick={() => setConsent('granted')}
                            className="order-1 sm:order-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[var(--wc-blue)] text-white hover:opacity-90 transition-opacity"
                        >
                            Accept analytics
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
