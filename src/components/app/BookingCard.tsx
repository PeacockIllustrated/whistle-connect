import Link from 'next/link'
import { cn, formatDate, formatTime } from '@/lib/utils'
import { StatusChip } from '@/components/ui/StatusChip'
import { BookingWithDetails, BookingStatus } from '@/lib/types'

export interface BookingCardProps {
    booking: BookingWithDetails
    showCoach?: boolean
    showReferee?: boolean
    className?: string
}

export function BookingCard({ booking, showCoach, showReferee, className }: BookingCardProps) {
    return (
        <Link
            href={`/app/bookings/${booking.id}`}
            className={cn(
                'card p-4 block',
                'transition-all duration-200',
                'hover:shadow-md active:scale-[0.99]',
                className
            )}
        >
            {/* Header Row */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[var(--foreground)] truncate">
                        {booking.ground_name || booking.location_postcode}
                    </h3>
                    {showCoach && booking.coach && (
                        <p className="text-sm text-[var(--foreground-muted)]">
                            {booking.coach.full_name}
                        </p>
                    )}
                </div>
                <StatusChip status={booking.status} size="sm" />
            </div>

            {/* Details Row */}
            <div className="flex items-center gap-4 text-sm text-[var(--foreground-muted)]">
                <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDate(booking.match_date)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
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
                    <div className="w-8 h-8 rounded-full bg-[var(--brand-green)] flex items-center justify-center text-white text-sm font-semibold">
                        {booking.assignment.referee.full_name.charAt(0)}
                    </div>
                    <div>
                        <p className="text-sm font-medium">{booking.assignment.referee.full_name}</p>
                        <p className="text-xs text-[var(--foreground-muted)]">Assigned Referee</p>
                    </div>
                </div>
            )}
        </Link>
    )
}

// Compact variant for lists
export function BookingCardCompact({ booking, className }: { booking: BookingWithDetails; className?: string }) {
    return (
        <Link
            href={`/app/bookings/${booking.id}`}
            className={cn(
                'flex items-center gap-3 p-3 bg-white border border-[var(--border-color)] rounded-lg',
                'transition-all duration-200',
                'hover:bg-[var(--neutral-50)]',
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
                <p className="font-medium text-sm truncate">{booking.ground_name || booking.location_postcode}</p>
                <p className="text-xs text-[var(--foreground-muted)]">{formatTime(booking.kickoff_time)}</p>
            </div>
            <StatusChip status={booking.status} size="sm" />
        </Link>
    )
}
