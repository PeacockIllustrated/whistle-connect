'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn, formatDate, formatTime, getStatusCardStyle } from '@/lib/utils'
import { StatusChip } from '@/components/ui/StatusChip'
import { BookingWithDetails, BookingStatus } from '@/lib/types'
import { deleteBooking, cancelBooking } from '@/app/app/bookings/actions'
import { useToast } from '@/components/ui/Toast'
import { Archive, MessageCircle, CalendarDays, Clock, XCircle } from 'lucide-react'

const ARCHIVE_STORAGE_KEY = 'wc:refereeArchivedBookings'

function readArchivedIds(): Set<string> {
    if (typeof window === 'undefined') return new Set()
    try {
        const raw = window.localStorage.getItem(ARCHIVE_STORAGE_KEY)
        if (!raw) return new Set()
        const arr = JSON.parse(raw)
        return Array.isArray(arr) ? new Set(arr.filter((v): v is string => typeof v === 'string')) : new Set()
    } catch {
        return new Set()
    }
}

function writeArchivedIds(ids: Set<string>) {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(Array.from(ids)))
    } catch {
        // localStorage may be disabled — silent
    }
}

export interface BookingCardProps {
    booking: BookingWithDetails & { offer_status?: string }
    /** When the current viewer is a referee. Misnamed historically — name reflects "show coach info on the card". */
    showCoach?: boolean
    showReferee?: boolean
    className?: string
}

export function BookingCard({ booking, showCoach, showReferee, className }: BookingCardProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [archived, setArchived] = useState(false)
    const { showToast } = useToast()

    const isReferee = !!showCoach
    const canArchive = isReferee && (booking.status === 'cancelled' || booking.status === 'completed')

    // After mount, hide if previously archived (referee view only).
    useEffect(() => {
        if (!isReferee) return
        if (readArchivedIds().has(booking.id)) setArchived(true)
    }, [isReferee, booking.id])

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
        } catch {
            showToast({ message: 'Failed to delete booking', type: 'error' })
        } finally {
            setIsLoading(false)
        }
    }

    const handleArchive = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm('Archive this booking? It will be hidden from your list.')) return

        const ids = readArchivedIds()
        ids.add(booking.id)
        writeArchivedIds(ids)
        setArchived(true)
        showToast({ message: 'Booking archived', type: 'success' })
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
        } catch {
            showToast({ message: 'Failed to cancel booking', type: 'error' })
        } finally {
            setIsLoading(false)
        }
    }

    // Referee view: hide if previously archived (post-mount, prevents hydration mismatch).
    if (archived) return null

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
            {/* Cancelled banner — impossible to miss when a coach has pulled a fixture */}
            {booking.status === 'cancelled' && (
                <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-md bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider w-fit">
                    <XCircle className="w-3 h-3" />
                    Cancelled{isReferee ? ' by coach' : ''}
                </div>
            )}

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
                {!showCoach && (booking.status === 'pending' || booking.status === 'offered' || booking.status === 'cancelled') && (
                    <button
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="text-xs text-red-600 font-medium hover:underline disabled:opacity-50"
                    >
                        {isLoading ? 'Deleting...' : 'Delete Booking'}
                    </button>
                )}

                {/* Referee Actions: Archive if cancelled or completed */}
                {canArchive && (
                    <button
                        onClick={handleArchive}
                        className="inline-flex items-center gap-1 text-xs text-[var(--foreground-muted)] font-medium hover:text-[var(--foreground)] hover:underline"
                    >
                        <Archive className="w-3.5 h-3.5" />
                        Archive
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
                        <MessageCircle className="w-4 h-4" />
                    </span>
                )}
                <StatusChip status={effectiveStatus} size="sm" />
            </div>
        </Link>
    )
}
