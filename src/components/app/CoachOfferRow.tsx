'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { StatusChip } from '@/components/ui/StatusChip'
import { SwipeableCard } from '@/components/ui/SwipeableCard'
import { CoachInterestActions } from '@/components/app/CoachInterestActions'
import { archiveOfferAsCoach } from '@/app/app/bookings/actions'
import { getStatusCardStyle } from '@/lib/utils'
import type { BookingOffer, OfferStatus, Profile } from '@/lib/types'

/**
 * A non-actionable offer row is one the coach can't take action on:
 *   - declined  : the ref turned it down
 *   - withdrawn : the offer was retracted (typically when another offer accepted)
 *   - expired   : the offer's response window passed
 *
 * These rows are pure visual clutter on the OFFERS list — the coach has no
 * decision left to make. Swipe-to-archive lets them sweep them out per-offer.
 * Actionable rows (sent / accepted / accepted_priced) are not swipeable.
 */
const NON_ACTIONABLE_STATUSES: OfferStatus[] = ['declined', 'withdrawn', 'expired']

interface CoachOfferRowProps {
    offer: BookingOffer & { referee: Profile | null }
    /** Match fee from the booking, used to seed the price modal on accept. */
    bookingFeePounds: number | null
}

export function CoachOfferRow({ offer, bookingFeePounds }: CoachOfferRowProps) {
    const router = useRouter()
    const [, startTransition] = useTransition()
    const [hidden, setHidden] = useState(false)

    // A ref-initiated "I'm Available" offer = status sent + no price set yet.
    // The coach must respond to it via CoachInterestActions (accept/decline/price).
    const isRefInitiated = offer.status === 'sent' && !offer.price_pence
    const isNonActionable = NON_ACTIONABLE_STATUSES.includes(offer.status)

    async function handleArchive() {
        // Optimistic — slide the row out, then call the server. If it fails,
        // router.refresh() will re-fetch and the row re-appears.
        setHidden(true)
        const result = await archiveOfferAsCoach(offer.id, true)
        if (result?.error) {
            console.error('archiveOfferAsCoach failed:', result.error)
            setHidden(false)
            startTransition(() => router.refresh())
        } else {
            startTransition(() => router.refresh())
        }
    }

    if (hidden) return null

    const card = (
        <div
            className={`p-2 rounded-lg ${getStatusCardStyle(offer.status) || 'bg-[var(--neutral-50)]'}`}
        >
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white text-sm font-semibold">
                    {offer.referee?.full_name?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium">
                        {offer.referee?.full_name || 'Unknown'}
                    </p>
                    {offer.status === 'accepted_priced' && offer.price_pence && (
                        <p className="text-xs text-green-600 font-medium">
                            Quoted: &pound;{(offer.price_pence / 100).toFixed(2)}
                        </p>
                    )}
                    {isRefInitiated && (
                        <p className="text-xs text-amber-700 font-medium">
                            Tapped &quot;I&apos;m Available&quot; — needs your response
                        </p>
                    )}
                    {isNonActionable && (
                        <p className="text-xs text-[var(--foreground-muted)] italic">
                            Swipe to clear
                        </p>
                    )}
                </div>
                <StatusChip status={offer.status} size="sm" />
            </div>
            {isRefInitiated && (
                <CoachInterestActions
                    offerId={offer.id}
                    refereeName={offer.referee?.full_name || 'this referee'}
                    defaultPricePounds={bookingFeePounds}
                />
            )}
        </div>
    )

    if (!isNonActionable) {
        return card
    }

    return (
        <SwipeableCard onArchive={handleArchive} actionLabel="Clear">
            {card}
        </SwipeableCard>
    )
}
