'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDate, formatTime } from '@/lib/utils'
import { StatusChip } from '@/components/ui/StatusChip'
import { ChevronDown, Star, Clock, CheckCircle, User, CalendarDays } from 'lucide-react'
import type { BookingStatus } from '@/lib/types'

// Types for what we pass from the server
export interface AdminBooking {
    id: string
    status: BookingStatus
    match_date: string
    kickoff_time: string
    home_team: string | null
    away_team: string | null
    ground_name: string | null
    location_postcode: string
    address_text: string | null
    format: string | null
    age_group: string | null
    is_sos: boolean
    coach_name: string | null
    referee_name: string | null
    rating: number | null
    punctuality: number | null
    communication: number | null
    professionalism: number | null
    comment: string | null
}

interface AdminBookingsViewProps {
    upcomingBookings: AdminBooking[]
    completedBookings: AdminBooking[]
}

function StarRating({ value, label }: { value: number | null; label: string }) {
    if (value === null) return null
    return (
        <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--foreground-muted)]">{label}</span>
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-3 h-3 ${star <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                    />
                ))}
            </div>
        </div>
    )
}

function CompletedBookingRow({ booking }: { booking: AdminBooking }) {
    const [expanded, setExpanded] = useState(false)
    const hasRating = booking.rating !== null

    const title = booking.home_team && booking.away_team
        ? `${booking.home_team} vs ${booking.away_team}`
        : (booking.address_text || booking.ground_name || booking.location_postcode)

    return (
        <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--neutral-50)] transition-colors"
            >
                {/* Date badge */}
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--neutral-100)] flex flex-col items-center justify-center">
                    <span className="text-xs font-bold text-[var(--foreground)]">
                        {new Date(booking.match_date).getDate()}
                    </span>
                    <span className="text-[10px] text-[var(--foreground-muted)] uppercase">
                        {new Date(booking.match_date).toLocaleDateString('en', { month: 'short' })}
                    </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-[var(--foreground)]">{title}</p>
                    <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                        <span>{formatTime(booking.kickoff_time)}</span>
                        {booking.referee_name && (
                            <>
                                <span>&middot;</span>
                                <span>{booking.referee_name}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Rating summary */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {hasRating ? (
                        <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-full">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="text-xs font-semibold text-amber-700">{booking.rating}/5</span>
                        </div>
                    ) : (
                        <span className="text-[10px] text-[var(--foreground-muted)] px-2 py-1 bg-[var(--neutral-100)] rounded-full">No rating</span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-[var(--foreground-muted)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/* Expanded details */}
            {expanded && (
                <div className="px-3 pb-3 border-t border-[var(--border-color)] pt-3 bg-[var(--neutral-50)]">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {/* Coach */}
                        <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-[var(--foreground-muted)]" />
                            <div>
                                <p className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wide">Coach</p>
                                <p className="text-sm font-medium">{booking.coach_name || 'Unknown'}</p>
                            </div>
                        </div>

                        {/* Referee */}
                        <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-[var(--foreground-muted)]" />
                            <div>
                                <p className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wide">Referee</p>
                                <p className="text-sm font-medium">{booking.referee_name || 'Unassigned'}</p>
                            </div>
                        </div>

                        {/* Match details */}
                        {booking.format && (
                            <div className="flex items-center gap-2">
                                <CalendarDays className="w-3.5 h-3.5 text-[var(--foreground-muted)]" />
                                <div>
                                    <p className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wide">Format</p>
                                    <p className="text-sm font-medium">{booking.format} {booking.age_group ? `• ${booking.age_group}` : ''}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Ratings */}
                    {hasRating && (
                        <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                            <p className="text-xs font-semibold text-[var(--foreground)] mb-2">Match Review</p>
                            <div className="grid grid-cols-1 gap-1.5">
                                <StarRating value={booking.rating} label="Overall" />
                                <StarRating value={booking.punctuality} label="Punctuality" />
                                <StarRating value={booking.communication} label="Communication" />
                                <StarRating value={booking.professionalism} label="Professionalism" />
                            </div>
                            {booking.comment && (
                                <p className="mt-2 text-xs text-[var(--foreground-muted)] italic bg-white rounded-md px-2.5 py-2 border border-[var(--border-color)]">
                                    &ldquo;{booking.comment}&rdquo;
                                </p>
                            )}
                        </div>
                    )}

                    {/* Link to booking detail */}
                    <Link
                        href={`/app/bookings/${booking.id}`}
                        className="mt-3 inline-flex items-center text-xs font-medium text-[var(--color-primary)] hover:underline"
                    >
                        View full booking &rarr;
                    </Link>
                </div>
            )}
        </div>
    )
}

export function AdminBookingsView({ upcomingBookings, completedBookings }: AdminBookingsViewProps) {
    const [showCompleted, setShowCompleted] = useState(false)

    return (
        <>
            {/* Upcoming / Active Bookings */}
            <div className="mb-6">
                <h2 className="font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--color-primary)]" />
                    Upcoming &amp; Active ({upcomingBookings.length})
                </h2>

                {upcomingBookings.length > 0 ? (
                    <div className="space-y-2">
                        {upcomingBookings.map((booking) => {
                            const title = booking.home_team && booking.away_team
                                ? `${booking.home_team} vs ${booking.away_team}`
                                : (booking.address_text || booking.ground_name || booking.location_postcode)

                            return (
                                <Link
                                    key={booking.id}
                                    href={`/app/bookings/${booking.id}`}
                                    className="flex items-center gap-3 p-3 border border-[var(--border-color)] rounded-lg hover:shadow-sm transition-all"
                                >
                                    {/* Date badge */}
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--neutral-100)] flex flex-col items-center justify-center">
                                        <span className="text-xs font-bold text-[var(--foreground)]">
                                            {new Date(booking.match_date).getDate()}
                                        </span>
                                        <span className="text-[10px] text-[var(--foreground-muted)] uppercase">
                                            {new Date(booking.match_date).toLocaleDateString('en', { month: 'short' })}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{title}</p>
                                        <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                                            <span>{formatDate(booking.match_date)}</span>
                                            <span>&middot;</span>
                                            <span>{formatTime(booking.kickoff_time)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--foreground-muted)]">
                                            {booking.coach_name && <span>Coach: {booking.coach_name}</span>}
                                            {booking.referee_name && (
                                                <>
                                                    <span>&middot;</span>
                                                    <span>Ref: {booking.referee_name}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status + extras */}
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <StatusChip status={booking.status} size="sm" />
                                        {booking.is_sos && (
                                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 rounded-full">SOS</span>
                                        )}
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-6 text-sm text-[var(--foreground-muted)] bg-[var(--neutral-50)] rounded-lg border border-[var(--border-color)]">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                        No upcoming bookings
                    </div>
                )}
            </div>

            {/* Completed Bookings Accordion */}
            {completedBookings.length > 0 && (
                <div className="mb-6">
                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] rounded-xl transition-all duration-200"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                                <CheckCircle className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="font-semibold text-sm text-white">
                                Completed Bookings ({completedBookings.length})
                            </span>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                            <ChevronDown className={`w-3.5 h-3.5 text-white transition-transform duration-300 ${showCompleted ? 'rotate-180' : ''}`} />
                        </div>
                    </button>

                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showCompleted ? 'max-h-[2000px] mt-3' : 'max-h-0'}`}>
                        <div className="space-y-2">
                            {completedBookings.map((booking) => (
                                <CompletedBookingRow key={booking.id} booking={booking} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
