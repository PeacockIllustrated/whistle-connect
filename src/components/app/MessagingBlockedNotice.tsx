import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

/**
 * Shown when in-app messaging is unavailable because an under-18 referee is
 * involved — a safeguarding hard block until they turn 18. Communication goes
 * via the parent/guardian by email instead. The matching server-side block
 * lives in sendMessage (actions.ts), both directions.
 *
 * `reason` tailors the copy to the audience:
 *  - 'self-minor' (default): the viewer is the under-18 referee.
 *  - 'counterpart-minor': the viewer (e.g. a coach) is trying to message a
 *    thread that includes an under-18 referee.
 */
export function MessagingBlockedNotice({
    reason = 'self-minor',
}: {
    reason?: 'self-minor' | 'counterpart-minor'
}) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <ShieldAlert className="h-8 w-8" />
            </div>
            <h1 className="mb-2 text-xl font-bold">In-app messaging isn&apos;t available</h1>
            <p className="mb-6 max-w-sm text-[var(--foreground-muted)] leading-relaxed">
                {reason === 'counterpart-minor' ? (
                    <>
                        This referee is under 18, so in-app messaging is unavailable. Please contact
                        their parent or guardian by email for any important match updates.
                    </>
                ) : (
                    <>
                        Because you&apos;re under 18, all communication must go through your parent or
                        guardian&apos;s email until you turn 18. Coaches are directed to contact them
                        with any important match updates.
                    </>
                )}
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
