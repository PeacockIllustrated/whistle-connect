'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { acceptOffer, declineOffer, cancelBooking, completeBooking } from '../actions'
import { BookingOffer, BookingWithDetails } from '@/lib/types'
// Input no longer needed — referee doesn't set price
import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay'
import { RatingModal } from '@/components/app/RatingModal'
import { Check, MessageCircle, CalendarDays, Clock, CheckCircle, XCircle, Ban, Pencil, Search, Star } from 'lucide-react'

interface BookingActionsProps {
    booking: BookingWithDetails
    userOffer?: BookingOffer | null
    isCoach: boolean
    isReferee: boolean
    threadId?: string
}

export function BookingActions({
    booking,
    userOffer,
    isCoach,
    isReferee,
    threadId
}: BookingActionsProps) {
    const router = useRouter()
    const { showToast } = useToast()
    const [accepting, setAccepting] = useState(false)
    const [declining, setDeclining] = useState(false)
    const [cancelling, setCancelling] = useState(false)
    const [completing, setCompleting] = useState(false)
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [showCompleteDialog, setShowCompleteDialog] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [celebration, setCelebration] = useState<{
        icon: 'check-circle' | 'party-popper' | 'send' | 'user-check' | 'calendar-check'
        title: string
        subtitle?: string
        onComplete?: () => void
    } | null>(null)
    const [showRatingModal, setShowRatingModal] = useState(false)
    const [hasRated, setHasRated] = useState(false)
    // Wallet balance no longer needed here — escrow check happens server-side

    // ─── Referee: Accept offer (coach already set the price) ───
    const handleAcceptOffer = async () => {
        if (!userOffer) return

        setAccepting(true)
        setErrorMessage('')
        try {
            const result = await acceptOffer(userOffer.id)
            if (result.success && result.threadId) {
                const threadId = result.threadId
                setCelebration({
                    icon: 'party-popper',
                    title: 'Booking Confirmed!',
                    subtitle: `You're booked in — £${((userOffer.price_pence || 0) / 100).toFixed(2)}`,
                    onComplete: () => router.push(`/app/messages/${threadId}`),
                })
            } else if (result.success) {
                setCelebration({
                    icon: 'party-popper',
                    title: 'Booking Confirmed!',
                    subtitle: `You're booked in — £${((userOffer.price_pence || 0) / 100).toFixed(2)}`,
                    onComplete: () => router.refresh(),
                })
            } else {
                setErrorMessage(result.error || 'Failed to accept offer')
                setAccepting(false)
            }
        } catch (error) {
            console.error('Failed to accept offer:', error)
            setErrorMessage('Failed to accept offer. Please try again.')
            setAccepting(false)
        }
    }

    // ─── Referee: Decline offer ───
    const handleDecline = async () => {
        if (!userOffer) return
        setDeclining(true)
        try {
            const result = await declineOffer(userOffer.id)
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
            } else {
                showToast({ message: 'Offer declined', type: 'info' })
            }
            router.refresh()
        } catch (error) {
            console.error('Failed to decline offer:', error)
            showToast({ message: 'Failed to decline offer', type: 'error' })
            setDeclining(false)
        }
    }

    // handleConfirmPrice removed — referees now confirm bookings directly when accepting

    // ─── Cancel booking (coach or referee) ───
    const handleCancel = async () => {
        setCancelling(true)
        try {
            const result = await cancelBooking(booking.id)
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
                setCancelling(false)
            } else {
                if (isReferee) {
                    showToast({ message: 'You have pulled out of this booking. The coach has been notified.', type: 'success' })
                } else {
                    showToast({ message: 'Booking cancelled', type: 'success' })
                }
                router.refresh()
            }
        } catch (error) {
            console.error('Failed to cancel booking:', error)
            showToast({ message: 'Failed to cancel booking', type: 'error' })
            setCancelling(false)
        }
    }

    // ─── Mark booking as completed (coach or referee) ───
    const handleComplete = async () => {
        setCompleting(true)
        try {
            const result = await completeBooking(booking.id)
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
                setCompleting(false)
            } else {
                setCelebration({
                    icon: 'calendar-check',
                    title: 'Match Completed!',
                    subtitle: 'Well done',
                    onComplete: () => router.refresh(),
                })
            }
        } catch (error) {
            console.error('Failed to complete booking:', error)
            showToast({ message: 'Failed to mark as completed', type: 'error' })
            setCompleting(false)
        }
    }

    // Helper: has kickoff time passed?
    const hasKickoffPassed = () => {
        const kickoff = new Date(`${booking.match_date}T${booking.kickoff_time}`)
        return new Date() > kickoff
    }

    // ─── Celebration overlay (shown after successful actions) ───
    if (celebration) {
        return (
            <CelebrationOverlay
                icon={celebration.icon}
                title={celebration.title}
                subtitle={celebration.subtitle}
                onComplete={celebration.onComplete}
            />
        )
    }

    // ═══════════════════════════════════════════════
    //  SCENARIO 1: Referee has a pending offer (sent)
    // ═══════════════════════════════════════════════
    if (isReferee && userOffer?.status === 'sent') {
        const displayPrice = (userOffer.price_pence || 0) / 100
        return (
            <div className="space-y-3">
                {errorMessage && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
                        {errorMessage}
                    </div>
                )}

                {/* Offered price with travel breakdown — read-only (coach set this) */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-sm text-green-700 mb-2 text-center">Offered Fee</p>
                    <p className="text-3xl font-bold text-green-700 text-center">&pound;{displayPrice.toFixed(2)}</p>

                    {/* Show breakdown if travel data exists */}
                    {userOffer.match_fee_pence != null && (
                        <div className="mt-3 pt-3 border-t border-green-200 space-y-1 text-xs">
                            <div className="flex justify-between text-green-700">
                                <span>Match fee</span>
                                <span>&pound;{(userOffer.match_fee_pence / 100).toFixed(2)}</span>
                            </div>
                            {userOffer.travel_cost_pence != null && userOffer.travel_cost_pence > 0 && (
                                <div className="flex justify-between text-green-700">
                                    <span>Travel{userOffer.travel_distance_km ? ` (${userOffer.travel_distance_km} km)` : ''}</span>
                                    <span>&pound;{(userOffer.travel_cost_pence / 100).toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <Button
                    fullWidth
                    variant="success"
                    onClick={handleAcceptOffer}
                    loading={accepting}
                    disabled={declining}
                >
                    <Check className="w-5 h-5 mr-2" />
                    Accept Offer
                </Button>
                <Button
                    fullWidth
                    variant="outline"
                    onClick={handleDecline}
                    loading={declining}
                    disabled={accepting}
                >
                    Decline Offer
                </Button>
            </div>
        )
    }

    // SCENARIO 2 (coach sees accepted_priced) removed — no longer part of the flow.
    // When a referee accepts, the booking goes straight to 'confirmed'.

    // ═══════════════════════════════════════════════
    //  SCENARIO 3: Confirmed/completed booking
    // ═══════════════════════════════════════════════
    if (booking.status === 'confirmed' || booking.status === 'completed') {
        return (
            <div className="space-y-3">
                {/* Message button */}
                {threadId && (
                    <Link href={`/app/messages/${threadId}`} className="block">
                        <Button fullWidth variant="primary">
                            <MessageCircle className="w-5 h-5 mr-2" />
                            Message
                        </Button>
                    </Link>
                )}

                {/* Calendar export — available to both coach and assigned referee */}
                {booking.status === 'confirmed' && (isCoach || isReferee) && (
                    <a
                        href={`/app/bookings/${booking.id}/export`}
                        download={`match-booking-${booking.id}.ics`}
                        className="w-full block"
                    >
                        <Button fullWidth variant="outline">
                            <CalendarDays className="w-5 h-5 mr-2" />
                            Add to Calendar
                        </Button>
                    </a>
                )}

                {/* Mark as Completed — Phase 2 dual confirmation flow.
                    Hide once the calling user has already marked. Show
                    a state banner above the button that explains what's
                    happening and what's at stake. */}
                {(() => {
                    if (!hasKickoffPassed()) return null
                    if (booking.status !== 'confirmed' && booking.status !== 'completed') return null
                    if (!isCoach && !isReferee) return null
                    if (booking.escrow_released_at) return null

                    const youMarked = isCoach
                        ? !!booking.coach_marked_complete_at
                        : !!booking.referee_marked_complete_at
                    const otherMarked = isCoach
                        ? !!booking.referee_marked_complete_at
                        : !!booking.coach_marked_complete_at
                    const otherLabel = isCoach
                        ? (booking.assignment?.referee?.full_name || 'The referee')
                        : (booking.coach?.full_name || 'The coach')
                    const youAction = isCoach ? 'release' : 'receive'
                    const escrowDisplay = booking.escrow_amount_pence != null
                        ? `£${(booking.escrow_amount_pence / 100).toFixed(2)}`
                        : 'the match fee'

                    // Both confirmed — escrow is releasing on the next cron tick. Hide button.
                    if (booking.both_confirmed_at) {
                        return (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-emerald-900">Both parties confirmed</p>
                                        <p className="text-xs text-emerald-800 mt-0.5">
                                            {escrowDisplay} is releasing to {isCoach ? 'the referee' : 'your wallet'} now. Raise a dispute immediately if there&apos;s a problem.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    // You marked, waiting for the other side — show banner, hide button
                    if (youMarked && !otherMarked) {
                        return (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-amber-900">You confirmed — waiting on {otherLabel}</p>
                                        <p className="text-xs text-amber-800 mt-0.5">
                                            {escrowDisplay} auto-releases 48 hours after kickoff if {otherLabel.toLowerCase()} doesn&apos;t confirm.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    // Other marked, you haven't yet — show "confirm now" prompt
                    const buttonLabel = otherMarked
                        ? `${otherLabel} confirmed — confirm to ${youAction} ${escrowDisplay} now`
                        : `Confirm match — ${youAction} ${escrowDisplay}`
                    const dialogMessage = otherMarked
                        ? `${otherLabel} has confirmed completion. Confirming releases ${escrowDisplay} ${isCoach ? `to ${otherLabel}` : 'to your wallet'} immediately.`
                        : `Confirming locks in ${escrowDisplay} ${
                            isCoach ? `to release to ${otherLabel}` : 'to come to your wallet'
                          }. ${otherLabel} must also confirm to release the funds — or escrow auto-releases 48 hours after kickoff.`

                    return (
                        <>
                            <Button
                                fullWidth
                                variant="success"
                                onClick={() => setShowCompleteDialog(true)}
                                loading={completing}
                            >
                                <CheckCircle className="w-5 h-5 mr-2" />
                                {buttonLabel}
                            </Button>
                            <ConfirmDialog
                                isOpen={showCompleteDialog}
                                onClose={() => setShowCompleteDialog(false)}
                                onConfirm={handleComplete}
                                title="Confirm match completion"
                                message={dialogMessage}
                                confirmLabel="Yes, confirm"
                                variant="primary"
                            />
                        </>
                    )
                })()}

                {/* Cancel button — BOTH coach and referee can cancel confirmed bookings */}
                {booking.status === 'confirmed' && (isCoach || isReferee) && (
                    <>
                        <Button
                            fullWidth
                            variant="danger"
                            onClick={() => setShowCancelDialog(true)}
                            loading={cancelling}
                        >
                            {isReferee ? 'Pull Out of Booking' : 'Cancel Booking'}
                        </Button>
                        <ConfirmDialog
                            isOpen={showCancelDialog}
                            onClose={() => setShowCancelDialog(false)}
                            onConfirm={handleCancel}
                            title={isReferee ? 'Pull Out of Booking' : 'Cancel Booking'}
                            message={
                                isReferee
                                    ? 'Are you sure you want to pull out? The coach will be notified and the booking will be reopened for another referee.'
                                    : 'Are you sure you want to cancel this booking? The assigned referee will be notified.'
                            }
                            confirmLabel={isReferee ? 'Yes, Pull Out' : 'Yes, Cancel'}
                            variant="danger"
                        />
                    </>
                )}

                {/* Raise Dispute — any booking still holding escrow is
                    disputable. Once escrow_released_at is set, the dispute
                    flow is locked (matches the gate in raiseDispute). */}
                {(() => {
                    if (booking.escrow_released_at) return null
                    if (!isCoach && !isReferee) return null
                    if (booking.status !== 'confirmed' && booking.status !== 'completed') return null

                    return (
                        <button
                            onClick={async () => {
                                const reason = prompt('Please describe the issue (minimum 10 characters):')
                                if (reason && reason.length >= 10) {
                                    const { raiseDispute } = await import('@/app/app/disputes/actions')
                                    const result = await raiseDispute(booking.id, reason)
                                    if (result.error) {
                                        showToast({ message: result.error, type: 'error' })
                                    } else {
                                        showToast({ message: 'Dispute raised. An admin will review it.', type: 'success' })
                                    }
                                }
                            }}
                            className="w-full rounded-lg border border-red-300 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                            Raise Dispute
                        </button>
                    )
                })()}

                {/* Rate Referee — coach only, completed bookings */}
                {isCoach && booking.status === 'completed' && booking.assignment?.referee && !hasRated && (
                    <>
                        <Button
                            fullWidth
                            variant="accent"
                            onClick={() => setShowRatingModal(true)}
                        >
                            <Star className="w-5 h-5 mr-2" />
                            Rate Referee
                        </Button>
                        {showRatingModal && (
                            <RatingModal
                                bookingId={booking.id}
                                refereeId={booking.assignment.referee.id}
                                refereeName={booking.assignment.referee.full_name}
                                onClose={() => setShowRatingModal(false)}
                                onRated={() => {
                                    setShowRatingModal(false)
                                    setHasRated(true)
                                    setCelebration({
                                        icon: 'check-circle',
                                        title: 'Rating Submitted!',
                                        subtitle: 'Thank you for your feedback',
                                    })
                                }}
                            />
                        )}
                    </>
                )}
            </div>
        )
    }

    // ═══════════════════════════════════════════════
    //  SCENARIO 4: Coach with pending/offered booking
    // ═══════════════════════════════════════════════
    if (isCoach && (booking.status === 'pending' || booking.status === 'offered')) {
        return (
            <div className="space-y-3">
                <div className="p-4 bg-[var(--neutral-50)] rounded-xl text-center">
                    {booking.status === 'offered' ? (
                        <>
                            <div className="flex justify-center mb-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand-primary)] opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--brand-primary)]" />
                                </span>
                            </div>
                            <p className="text-sm text-[var(--foreground-muted)]">
                                Waiting for referees to respond...
                            </p>
                        </>
                    ) : (
                        <>
                            <Search className="w-5 h-5 mx-auto mb-2 text-[var(--foreground-muted)] opacity-60" />
                            <p className="text-sm text-[var(--foreground-muted)]">
                                No offers sent yet — find referees below
                            </p>
                        </>
                    )}
                </div>
                <Link href={`/app/bookings/${booking.id}/match`} className="block">
                    <Button fullWidth variant="primary">
                        <Search className="w-5 h-5 mr-2" />
                        Find Referees
                    </Button>
                </Link>
                <Link href={`/app/bookings/${booking.id}/edit`} className="block">
                    <Button fullWidth variant="outline">
                        <Pencil className="w-5 h-5 mr-2" />
                        Edit Booking
                    </Button>
                </Link>
                <Button
                    fullWidth
                    variant="danger"
                    onClick={() => setShowCancelDialog(true)}
                    loading={cancelling}
                >
                    Cancel Booking
                </Button>
                <ConfirmDialog
                    isOpen={showCancelDialog}
                    onClose={() => setShowCancelDialog(false)}
                    onConfirm={handleCancel}
                    title="Cancel Booking"
                    message="Are you sure you want to cancel this booking? All pending offers will be withdrawn."
                    confirmLabel="Yes, Cancel"
                    variant="danger"
                />
            </div>
        )
    }

    // ═══════════════════════════════════════════════
    //  SCENARIO 5: Referee who already responded
    // ═══════════════════════════════════════════════
    if (isReferee && userOffer) {
        return (
            <div className="space-y-3">
                {/* Status card */}
                <div className={`p-4 rounded-xl text-center ${
                    userOffer.status === 'accepted_priced'
                        ? 'bg-amber-50 border border-amber-200'
                        : userOffer.status === 'accepted'
                            ? 'bg-green-50 border border-green-200'
                            : userOffer.status === 'declined'
                                ? 'bg-red-50 border border-red-200'
                                : 'bg-[var(--neutral-50)] border border-[var(--border-color)]'
                }`}>
                    {/* Icon */}
                    <div className="flex justify-center mb-2">
                        {userOffer.status === 'accepted_priced' && (
                            <Clock className="w-8 h-8 text-amber-500" />
                        )}
                        {userOffer.status === 'accepted' && (
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        )}
                        {userOffer.status === 'declined' && (
                            <XCircle className="w-8 h-8 text-red-400" />
                        )}
                        {userOffer.status === 'withdrawn' && (
                            <Ban className="w-8 h-8 text-[var(--neutral-400)]" />
                        )}
                    </div>

                    {/* Status text */}
                    <p className={`text-sm font-semibold ${
                        userOffer.status === 'accepted_priced' ? 'text-amber-700' :
                        userOffer.status === 'accepted' ? 'text-green-700' :
                        userOffer.status === 'declined' ? 'text-red-700' :
                        'text-[var(--foreground-muted)]'
                    }`}>
                        {userOffer.status === 'accepted_priced' && 'Waiting for coach to confirm your price'}
                        {userOffer.status === 'accepted' && 'Booking confirmed'}
                        {userOffer.status === 'declined' && 'You declined this offer'}
                        {userOffer.status === 'withdrawn' && 'This offer was withdrawn'}
                    </p>

                    {/* Show price if accepted_priced */}
                    {userOffer.status === 'accepted_priced' && userOffer.price_pence && (
                        <p className="text-lg font-bold text-amber-700 mt-1">
                            &pound;{(userOffer.price_pence / 100).toFixed(2)}
                        </p>
                    )}
                </div>

                {/* Message link if thread exists */}
                {threadId && (
                    <Link href={`/app/messages/${threadId}`}>
                        <Button fullWidth variant="outline">
                            <MessageCircle className="w-5 h-5 mr-2" />
                            Message Coach
                        </Button>
                    </Link>
                )}
            </div>
        )
    }

    return null
}
