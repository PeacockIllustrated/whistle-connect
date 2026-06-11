import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

/**
 * Shown to under-18 referees who reach the messaging UI. In-app messaging is a
 * safeguarding hard block until they turn 18 — coaches contact the parent /
 * guardian by email instead (see the booking detail "Email parent" CTA). The
 * matching server-side block lives in sendMessage (actions.ts).
 */
export function MessagingBlockedNotice() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <ShieldAlert className="h-8 w-8" />
            </div>
            <h1 className="mb-2 text-xl font-bold">In-app messaging isn&apos;t available</h1>
            <p className="mb-6 max-w-sm text-[var(--foreground-muted)] leading-relaxed">
                Because you&apos;re under 18, all communication must go through your parent or
                guardian&apos;s email until you turn 18. Coaches are directed to contact them with any
                important match updates.
            </p>
            <Link
                href="/app"
                className="rounded-lg bg-[var(--brand-navy)] px-6 py-2.5 font-medium text-white"
            >
                Back to home
            </Link>
        </div>
    )
}
