'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { acceptOffer, declineOffer, cancelBooking, confirmPrice } from '../actions'
import { Booking, BookingOffer, BookingWithDetails } from '@/lib/types'
import { Input } from '@/components/ui/Input'

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
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [price, setPrice] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    // ─── Referee: Accept offer with price ───
    const handleAcceptWithPrice = async () => {
        if (!userOffer) return

        const priceNum = parseFloat(price)
        if (isNaN(priceNum) || priceNum <= 0) {
            setErrorMessage('Please enter a valid price')
            return
        }

        setAccepting(true)
        setErrorMessage('')
        try {
            const result = await acceptOffer(userOffer.id, priceNum)
            if (result.success) {
                showToast({
                    message: `Price of \u00A3${priceNum.toFixed(2)} sent to coach!`,
                    type: 'success',
                })
                router.refresh()
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

    // ─── Coach: Confirm price → creates assignment + thread ───
    const handleConfirmPrice = async (offerId: string) => {
        setAccepting(true)
        setErrorMessage('')
        try {
            const result = await confirmPrice(offerId)
            if (result.success && result.threadId) {
                showToast({ message: 'Booking confirmed!', type: 'success' })
                router.push(`/app/messages/${result.threadId}`)
            } else {
                setErrorMessage(result.error || 'Failed to confirm booking. Please try again.')
                showToast({ message: result.error || 'Failed to confirm booking', type: 'error' })
                setAccepting(false)
            }
        } catch (error) {
            console.error('Failed to confirm price:', error)
            setErrorMessage('Something went wrong. Please try again.')
            showToast({ message: 'Failed to confirm booking', type: 'error' })
            setAccepting(false)
        }
    }

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

    // ═══════════════════════════════════════════════
    //  SCENARIO 1: Referee has a pending offer (sent)
    // ═══════════════════════════════════════════════
    if (isReferee && userOffer?.status === 'sent') {
        return (
            <div className="space-y-3">
                {errorMessage && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
                        {errorMessage}
                    </div>
                )}

                {/* Price input shown immediately — no confusing two-step */}
                <div className="p-4 bg-[var(--background-elevated)] border border-[var(--border-color)] rounded-xl space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-semibold">Your fee for this match</p>
                    </div>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] font-medium">&pound;</span>
                        <Input
                            type="number"
                            placeholder="0.00"
                            value={price}
                            onChange={(e) => {
                                setPrice(e.target.value)
                                setErrorMessage('')
                            }}
                            className="pl-7"
                            step="0.01"
                            min="0"
                        />
                    </div>
                    <p className="text-[10px] text-[var(--foreground-muted)]">
                        Enter your total fee including travel and expenses.
                    </p>
                </div>

                <Button
                    fullWidth
                    onClick={handleAcceptWithPrice}
                    loading={accepting}
                    disabled={declining || !price}
                >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Accept &amp; Send Price
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

    // ═══════════════════════════════════════════════
    //  SCENARIO 2: Coach sees a priced offer
    // ═══════════════════════════════════════════════
    const pricedOffer = isCoach && booking.offers?.find(o => o.status === 'accepted_priced')
    if (pricedOffer && booking.status !== 'confirmed') {
        const displayPrice = (pricedOffer.price_pence || 0) / 100
        const refereeInfo = pricedOffer.referee as { full_name?: string } | null
        return (
            <div className="space-y-3">
                {errorMessage && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-center">
                        {errorMessage}
                    </div>
                )}

                {/* Referee who sent the price */}
                <div className="card p-4">
                    <h3 className="text-sm font-semibold text-[var(--foreground-muted)] mb-3">REFEREE</h3>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white font-semibold">
                            {refereeInfo?.full_name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                            <p className="font-medium">{refereeInfo?.full_name || 'Unknown Referee'}</p>
                            <p className="text-sm text-[var(--foreground-muted)]">Has accepted your request</p>
                        </div>
                    </div>
                </div>

                {/* Price Display */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                    <p className="text-sm text-green-700 mb-1">Proposed Fee</p>
                    <p className="text-3xl font-bold text-green-700">&pound;{displayPrice.toFixed(2)}</p>
                    <p className="text-xs text-green-600 mt-2">
                        This is the referee&apos;s fee including travel and expenses.
                    </p>
                </div>

                <Button
                    fullWidth
                    onClick={() => handleConfirmPrice(pricedOffer.id)}
                    loading={accepting}
                >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Accept Price &amp; Confirm Booking
                </Button>
                <Button
                    fullWidth
                    variant="outline"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={accepting}
                >
                    Decline &amp; Cancel
                </Button>
                <ConfirmDialog
                    isOpen={showCancelDialog}
                    onClose={() => setShowCancelDialog(false)}
                    onConfirm={handleCancel}
                    title="Cancel Booking"
                    message="Are you sure you want to cancel this booking? This action cannot be undone."
                    confirmLabel="Yes, Cancel"
                    variant="danger"
                />
            </div>
        )
    }

    // ═══════════════════════════════════════════════
    //  SCENARIO 3: Confirmed/completed booking
    // ═══════════════════════════════════════════════
    if (booking.status === 'confirmed' || booking.status === 'completed') {
        return (
            <div className="space-y-3">
                {/* Message button */}
                {threadId && (
                    <Link href={`/app/messages/${threadId}`}>
                        <Button fullWidth variant="primary">
                            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Message
                        </Button>
                    </Link>
                )}

                {/* Calendar export for referee */}
                {isReferee && booking.status === 'confirmed' && (
                    <a
                        href={`/app/bookings/${booking.id}/export`}
                        download={`match-booking-${booking.id}.ics`}
                        className="w-full block"
                    >
                        <Button fullWidth variant="outline">
                            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Add to Calendar
                        </Button>
                    </a>
                )}

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
                    <div className="flex justify-center mb-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand-primary)] opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--brand-primary)]" />
                        </span>
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        {booking.status === 'pending'
                            ? 'Searching for available referees...'
                            : 'Waiting for referees to respond...'}
                    </p>
                </div>
                <Link href={`/app/bookings/${booking.id}/edit`}>
                    <Button fullWidth variant="outline">
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
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
                            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        {userOffer.status === 'accepted' && (
                            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        {userOffer.status === 'declined' && (
                            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        {userOffer.status === 'withdrawn' && (
                            <svg className="w-8 h-8 text-[var(--neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
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
                            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Message Coach
                        </Button>
                    </Link>
                )}
            </div>
        )
    }

    return null
}
