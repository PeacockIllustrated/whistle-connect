'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
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
    const [accepting, setAccepting] = useState(false)
    const [declining, setDeclining] = useState(false)
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [showPriceInput, setShowPriceInput] = useState(false)
    const [price, setPrice] = useState('')

    const handleAccept = async () => {
        if (!userOffer) return
        if (!showPriceInput) {
            setShowPriceInput(true)
            return
        }

        const priceNum = parseFloat(price)
        if (isNaN(priceNum) || priceNum <= 0) {
            alert('Please enter a valid price')
            return
        }

        setAccepting(true)
        try {
            const result = await acceptOffer(userOffer.id, priceNum)
            if (result.success) {
                router.refresh()
            } else {
                setAccepting(false)
            }
        } catch (error) {
            console.error('Failed to accept offer:', error)
            setAccepting(false)
        }
    }

    const handleDecline = async () => {
        if (!userOffer) return
        setDeclining(true)
        try {
            await declineOffer(userOffer.id)
            router.refresh()
        } catch (error) {
            console.error('Failed to decline offer:', error)
            setDeclining(false)
        }
    }

    const handleConfirmPrice = async (offerId: string) => {
        setAccepting(true)
        try {
            const result = await confirmPrice(offerId)
            if (result.success && result.threadId) {
                router.push(`/app/messages/${result.threadId}`)
            } else {
                setAccepting(false)
            }
        } catch (error) {
            console.error('Failed to confirm price:', error)
            setAccepting(false)
        }
    }

    const handleCancel = async () => {
        try {
            await cancelBooking(booking.id)
            router.refresh()
        } catch (error) {
            console.error('Failed to cancel booking:', error)
        }
    }

    // Referee actions for pending offer
    if (isReferee && userOffer?.status === 'sent') {
        return (
            <div className="space-y-3">
                {showPriceInput && (
                    <div className="p-4 bg-white border border-[var(--border-color)] rounded-xl space-y-3">
                        <p className="text-sm font-semibold">Enter your fee for this match</p>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] font-medium">£</span>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="pl-7"
                                step="0.01"
                                min="0"
                            />
                        </div>
                        <p className="text-[10px] text-[var(--foreground-muted)]">
                            Final price includes all travel and expenses.
                        </p>
                    </div>
                )}
                <Button
                    fullWidth
                    onClick={handleAccept}
                    loading={accepting}
                    disabled={declining}
                >
                    {showPriceInput ? 'Accept & Send Price' : 'Accept Offer'}
                </Button>
                <Button
                    fullWidth
                    variant="outline"
                    onClick={() => showPriceInput ? setShowPriceInput(false) : handleDecline()}
                    loading={declining}
                    disabled={accepting}
                >
                    {showPriceInput ? 'Back' : 'Decline'}
                </Button>
            </div>
        )
    }

    // Coach actions for a priced offer
    const pricedOffer = isCoach && booking.offers?.find(o => o.status === 'accepted_priced')
    if (pricedOffer && booking.status !== 'confirmed') {
        const displayPrice = (pricedOffer.price_pence || 0) / 100
        return (
            <div className="space-y-3">
                <div className="p-4 bg-[var(--neutral-50)] border border-[var(--border-color)] rounded-xl text-center">
                    <p className="text-sm text-[var(--foreground-muted)] mb-1">Proposed Fee</p>
                    <p className="text-2xl font-bold">£{displayPrice.toFixed(2)}</p>
                    <p className="text-xs text-[var(--foreground-muted)] mt-2 italic">
                        Accept the price to finalize the booking and start chat.
                    </p>
                </div>
                <Button
                    fullWidth
                    onClick={() => handleConfirmPrice(pricedOffer.id)}
                    loading={accepting}
                >
                    Accept Price & Confirm
                </Button>
                <Button
                    fullWidth
                    variant="danger"
                    onClick={() => setShowCancelDialog(true)}
                >
                    Decline & Cancel Booking
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

    // Message button if thread exists and booking is confirmed/completed
    if (threadId && (booking.status === 'confirmed' || booking.status === 'completed')) {
        return (
            <div className="space-y-3">
                <Link href={`/app/messages/${threadId}`}>
                    <Button fullWidth variant="primary">
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Message
                    </Button>
                </Link>

                {isReferee && booking.status === 'confirmed' && (
                    <a
                        href={`/app/bookings/${booking.id}/export`}
                        download={`match-booking-${booking.id}.ics`}
                        className="w-full"
                    >
                        <Button fullWidth variant="outline">
                            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Add to Calendar
                        </Button>
                    </a>
                )}

                {isCoach && booking.status !== 'completed' && (
                    <>
                        <Button
                            fullWidth
                            variant="danger"
                            onClick={() => setShowCancelDialog(true)}
                        >
                            Cancel Booking
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
                    </>
                )}
            </div>
        )
    }

    // Coach pending/offered actions
    if (isCoach && (booking.status === 'pending' || booking.status === 'offered')) {
        return (
            <div className="space-y-3">
                <div className="p-4 bg-[var(--neutral-50)] rounded-lg text-center">
                    <p className="text-sm text-[var(--foreground-muted)]">
                        {booking.status === 'pending'
                            ? 'Searching for available referees...'
                            : 'Waiting for referees to respond...'}
                    </p>
                </div>
                <Button
                    fullWidth
                    variant="danger"
                    onClick={() => setShowCancelDialog(true)}
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

    // Referee who has already responded
    if (isReferee && userOffer) {
        return (
            <div className="p-4 bg-[var(--neutral-50)] rounded-lg text-center">
                <p className="text-sm text-[var(--foreground-muted)]">
                    {userOffer.status === 'accepted' && 'You accepted this offer (Confirmed)'}
                    {userOffer.status === 'accepted_priced' && 'You sent a price. Waiting for coach confirmation.'}
                    {userOffer.status === 'declined' && 'You declined this offer'}
                    {userOffer.status === 'withdrawn' && 'This offer was withdrawn'}
                </p>
            </div>
        )
    }

    return null
}
