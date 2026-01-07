'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { acceptOffer, declineOffer, cancelBooking } from '../actions'
import { Booking, BookingOffer } from '@/lib/types'

interface BookingActionsProps {
    booking: Booking
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
    const [accepting, setAccepting] = useState(false)
    const [declining, setDeclining] = useState(false)
    const [showCancelDialog, setShowCancelDialog] = useState(false)

    const handleAccept = async () => {
        if (!userOffer) return
        setAccepting(true)
        try {
            await acceptOffer(userOffer.id)
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
        } catch (error) {
            console.error('Failed to decline offer:', error)
            setDeclining(false)
        }
    }

    const handleCancel = async () => {
        try {
            await cancelBooking(booking.id)
        } catch (error) {
            console.error('Failed to cancel booking:', error)
        }
    }

    // Referee actions for pending offer
    if (isReferee && userOffer?.status === 'sent') {
        return (
            <div className="space-y-3">
                <Button
                    fullWidth
                    onClick={handleAccept}
                    loading={accepting}
                    disabled={declining}
                >
                    Accept Offer
                </Button>
                <Button
                    fullWidth
                    variant="outline"
                    onClick={handleDecline}
                    loading={declining}
                    disabled={accepting}
                >
                    Decline
                </Button>
            </div>
        )
    }

    // Message button if thread exists
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

                {isCoach && booking.status !== 'completed' && booking.status !== 'cancelled' && (
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
                    {userOffer.status === 'accepted' && 'You accepted this offer'}
                    {userOffer.status === 'declined' && 'You declined this offer'}
                    {userOffer.status === 'withdrawn' && 'This offer was withdrawn'}
                </p>
            </div>
        )
    }

    return null
}
