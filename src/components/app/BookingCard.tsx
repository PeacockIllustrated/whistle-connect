'use client'
import { useState } from 'react'
import Link from 'next/link'
import { cn, formatDate, formatTime, getStatusCardStyle } from '@/lib/utils'
import { StatusChip } from '@/components/ui/StatusChip'
import { BookingWithDetails, BookingStatus } from '@/lib/types'
import { deleteBooking, cancelBooking } from '@/app/app/bookings/actions'
import { useToast } from '@/components/ui/Toast'
import { MessageCircle, CalendarDays, Clock } from 'lucide-react'

export interface BookingCardProps {
    booking: BookingWithDetails & { offer_status?: string }
    showCoach?: boolean
    showReferee?: boolean
    className?: string
}

export function BookingCard({ booking, showCoach, showReferee, className }: BookingCardProps) {
    const [isLoading, setIsLoading] = useState(false)
    const { showToast } = useToast()

    // Determine status to show
    // If user is referee (showCoach is true), show their specific offer status if not confirmed/completed
    // Otherwise show global booking status
    const effectiveStatus = (showCoach && booking.offer_status && booking.status !== 'confirmed' && booking.status !== 'completed' && booking.status !== 'cancelled')
        ? booking.offer_status as BookingStatus
        : booking.status

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm('Are you sure you want to delete this booking?')) return

        setIsLoading(true)
        try {
            const result = await deleteBooking(booking.id)
            if (result.error) throw new Error(result.error)
            showToast({ message: 'Booking deleted', type: 'success' })
        } catch (error) {
            showToast({ message: 'Failed to delete booking', type: 'error' })
        } finally {
            setIsLoading(false)
        }
    }

    const handleCancel = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm('Are you sure you want to cancel this booking? The coach will be notified.')) return

        setIsLoading(true)
        try {
            const result = await cancelBooking(booking.id)
            if (result.error) throw new Error(result.error)
            showToast({ message: 'Booking cancelled', type: 'success' })
        } catch (error) {
            showToast({ message: 'Failed to cancel booking', type: 'error' })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Link
            href={`/app/bookings/${booking.id}`}
            className={cn(
                'card p-4 block',
                'transition-all duration-200',
                'hover:shadow-md active:scale-[0.99]',
                getStatusCardStyle(effectiveStatus),
                className
            )}
        >
            {/* Header Row */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[var(--foreground)] truncate">
                        {booking.home_team && booking.away_team
                            ? `${booking.home_team} vs ${booking.away_team}`
                            : (booking.address_text || booking.ground_name || booking.location_postcode)}
                    </h3>
                    {showCoach && booking.coach && (
                        <p className="text-sm text-[var(--foreground-muted)]">
                            {booking.coach.full_name}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {booking.thread && booking.status === 'confirmed' && (
                        <span
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                window.location.href = `/app/messages/${booking.thread?.id}`
                            }}
                            className="p-1.5 bg-[var(--brand-primary)] text-white rounded-full hover:bg-[var(--brand-navy)] transition-colors"
                        >
                            <MessageCircle className="w-4 h-4" />
                        </span>
                    )}
                    <StatusChip status={effectiveStatus} size="sm" />
                </div>
            </div>

            {/* Details Row */}
            <div className="flex items-center gap-4 text-sm text-[var(--foreground-muted)]">
                <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4" />
                    <span>{formatDate(booking.match_date)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(booking.kickoff_time)}</span>
                </div>
            </div>

            {/* Format/Age Group */}
            <div className="flex items-center gap-2 mt-2">
                {booking.format && (
                    <span className="px-2 py-0.5 bg-[var(--neutral-100)] text-[var(--neutral-600)] text-xs font-medium rounded">
                        {booking.format}
                    </span>
                )}
                {booking.age_group && (
                    <span className="px-2 py-0.5 bg-[var(--neutral-100)] text-[var(--neutral-600)] text-xs font-medium rounded">
                        {booking.age_group}
                    </span>
                )}
            </div>

            {/* Referee Assignment */}
            {showReferee && booking.assignment?.referee && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-color)]">
                    <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)] flex items-center justify-center text-white text-sm font-semibold">
                        {booking.assignment.referee.full_name.charAt(0)}
                    </div>
                    <div>
                        <p className="text-sm font-medium">{booking.assignment.referee.full_name}</p>
                        <p className="text-xs text-[var(--foreground-muted)]">Assigned Referee</p>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="mt-3 flex justify-end">
                {/* Coach Actions: Delete if pending/offered */}
                {!showCoach && (booking.status === 'pending' || booking.status === 'offered') && (
                    <button
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="text-xs text-red-600 font-medium hover:underline disabled:opacity-50"
                    >
                        {isLoading ? 'Deleting...' : 'Delete Booking'}
                    </button>
                )}

                {/* Referee Actions: Cancel if confirmed */}
                {showCoach && booking.status === 'confirmed' && (
                    <button
                        onClick={handleCancel}
                        disabled={isLoading}
                        className="text-xs text-red-600 font-medium hover:underline disabled:opacity-50"
                    >
                        {isLoading ? 'Cancelling...' : 'Cancel Job'}
                    </button>
                )}
            </div>
        </Link>
    )
}

// Compact variant for lists
export function BookingCardCompact({ booking, className }: { booking: BookingWithDetails & { offer_status?: string }; className?: string }) {
    // Basic offer logic for compact view too
    const effectiveStatus = (booking.offer_status && booking.status !== 'confirmed' && booking.status !== 'completed' && booking.status !== 'cancelled')
        ? booking.offer_status as BookingStatus
        : booking.status

    return (
        <Link
            href={`/app/bookings/${booking.id}`}
            className={cn(
                'flex items-center gap-3 p-3 border border-[var(--border-color)] rounded-lg',
                'transition-all duration-200',
                'hover:shadow-sm',
                getStatusCardStyle(effectiveStatus),
                className
            )}
        >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--neutral-100)] flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-[var(--foreground)]">
                    {new Date(booking.match_date).getDate()}
                </span>
                <span className="text-[10px] text-[var(--foreground-muted)] uppercase">
                    {new Date(booking.match_date).toLocaleDateString('en', { month: 'short' })}
                </span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                    {booking.home_team && booking.away_team
                        ? `${booking.home_team} vs ${booking.away_team}`
                        : (booking.address_text || booking.ground_name || booking.location_postcode)}
                </p>
                <p className="text-xs text-[var(--foreground-muted)]">{formatTime(booking.kickoff_time)}</p>
            </div>
            <div className="flex items-center gap-2">
                {booking.thread && booking.status === 'confirmed' && (
                    <span
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            window.location.href = `/app/messages/${booking.thread?.id}`
                        }}
                        className="p-1.5 text-[var(--brand-primary)] hover:bg-[var(--neutral-100)] rounded-full transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </span>
                )}
                <StatusChip status={effectiveStatus} size="sm" />
            </div>
        </Link>
    )
}
