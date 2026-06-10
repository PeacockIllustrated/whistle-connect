import { ShieldAlert } from 'lucide-react'

interface ParentalConsentBannerProps {
    /** Only rendered for these two states; 'verified'/'not_required' show nothing. */
    status: 'awaiting' | 'rejected'
    /** Parent/guardian email the approval link was sent to, if known. */
    parentEmail: string | null
}

/**
 * Full-width banner shown across the top of the app shell for an under-18
 * referee whose account is locked pending (or after a declined) parental /
 * guardian consent. The hard gates live server-side (search exclusion,
 * booking/offer rejection, messaging block); this just makes the locked state
 * visible and explains the next step.
 */
export function ParentalConsentBanner({ status, parentEmail }: ParentalConsentBannerProps) {
    const rejected = status === 'rejected'

    return (
        <div
            role="status"
            className={
                rejected
                    ? 'bg-red-50 border-b border-red-200 text-red-800'
                    : 'bg-amber-50 border-b border-amber-200 text-amber-900'
            }
        >
            <div className="max-w-[var(--content-max-width)] mx-auto px-4 py-3 flex items-start gap-3">
                <ShieldAlert
                    className={`w-5 h-5 flex-shrink-0 mt-0.5 ${rejected ? 'text-red-600' : 'text-amber-600'}`}
                />
                <p className="text-sm leading-relaxed">
                    {rejected ? (
                        <>
                            <span className="font-semibold">Account not approved.</span>{' '}
                            A parent or guardian declined consent for this account, so it can&apos;t be
                            used. Please contact support if you think this is a mistake.
                        </>
                    ) : (
                        <>
                            <span className="font-semibold">Awaiting parent/guardian approval.</span>{' '}
                            Because you&apos;re under 18, a parent or guardian must approve your account
                            before you can be booked, message coaches, or appear in referee search.{' '}
                            {parentEmail ? (
                                <>
                                    We&apos;ve emailed{' '}
                                    <span className="font-medium">{parentEmail}</span> a one-click
                                    approval link.
                                </>
                            ) : (
                                <>We&apos;ve emailed your parent or guardian a one-click approval link.</>
                            )}
                        </>
                    )}
                </p>
            </div>
        </div>
    )
}
