'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { searchRefereesForBooking, sendBookingRequest, getTravelRate } from '../../actions'
import { RefereeSearchResult } from '@/lib/types'
import { RefereeSearchResultCard } from '@/components/app/RefereeSearchResultCard'
import { FAStatusBadge } from '@/components/ui/FAStatusBadge'
import { BOOKING_FEE_PENCE } from '@/lib/constants'
import Image from 'next/image'
import { ChevronLeft, Check, Search, X, ShieldCheck, MapPin, Receipt, Banknote, Pencil, Radar, AlertTriangle } from 'lucide-react'

interface Props {
    params: Promise<{ id: string }>
}

export default function BookingMatchPage({ params }: Props) {
    const { id } = use(params)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [results, setResults] = useState<RefereeSearchResult[]>([])
    const [selectedReferee, setSelectedReferee] = useState<RefereeSearchResult | null>(null)
    const [sentRequests, setSentRequests] = useState<string[]>([])
    // Match fee comes from the booking itself (set on New Booking form / Edit page).
    const [matchFeePounds, setMatchFeePounds] = useState<number | null>(null)
    // Whether the booking will appear in nearby refs' feed (depends on geocoding).
    const [feedVisible, setFeedVisible] = useState<boolean | null>(null)
    const [travelRatePence, setTravelRatePence] = useState(28) // default £0.28/km

    useEffect(() => {
        const load = async () => {
            setIsLoading(true)
            try {
                const [searchResult, rate] = await Promise.all([
                    searchRefereesForBooking(id),
                    getTravelRate(),
                ])
                if (searchResult.error) {
                    setError(searchResult.error)
                } else {
                    setResults(searchResult.data || [])
                    setMatchFeePounds(searchResult.bookingFeePounds ?? null)
                    setFeedVisible(searchResult.bookingFeedVisible ?? false)
                }
                setTravelRatePence(rate)
            } catch {
                setError('Failed to load matching referees')
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [id])

    /** Calculate travel cost for a referee in pence */
    const calcTravelPence = (distKm: number | null) => {
        if (!distKm || distKm <= 0) return 0
        return Math.round(distKm * travelRatePence)
    }

    /** Format pence as £ string */
    const fmtPrice = (pence: number) => '£' + (pence / 100).toFixed(2)

    const handleRequest = async (referee: RefereeSearchResult) => {
        if (!matchFeePounds || matchFeePounds <= 0) {
            setError('This booking has no match fee set. Edit the booking to add one.')
            return
        }

        setIsSubmitting(true)
        setError('')

        try {
            const result = await sendBookingRequest(id, referee.id, matchFeePounds, referee.distance_km)
            if (result.error) {
                setError(result.error)
                setIsSubmitting(false)
            } else {
                setSentRequests(prev => [...prev, referee.id])
                setIsSubmitting(false)
            }
        } catch {
            setError('Failed to send request')
            setIsSubmitting(false)
        }
    }

    /** Total in pence: match fee + travel + platform booking fee */
    const calcTotalPence = (referee: RefereeSearchResult, feePence: number) => {
        return feePence + calcTravelPence(referee.distance_km) + BOOKING_FEE_PENCE
    }

    /** Render the cost breakdown for a specific referee */
    const renderBreakdown = (referee: RefereeSearchResult) => {
        if (!matchFeePounds || matchFeePounds <= 0) return null

        const feePence = Math.round(matchFeePounds * 100)
        const travelPence = calcTravelPence(referee.distance_km)
        const totalPence = feePence + travelPence + BOOKING_FEE_PENCE

        return (
            <div className="mt-3 p-3 bg-[var(--neutral-50)] rounded-lg border border-[var(--border-color)] text-xs space-y-1">
                <div className="flex justify-between">
                    <span className="text-[var(--foreground-muted)]">Match fee</span>
                    <span className="font-medium">{fmtPrice(feePence)}</span>
                </div>
                {travelPence > 0 && (
                    <div className="flex justify-between">
                        <span className="text-[var(--foreground-muted)]">
                            Travel ({referee.distance_km?.toFixed(1)} km × {fmtPrice(travelRatePence)}/km)
                        </span>
                        <span className="font-medium">{fmtPrice(travelPence)}</span>
                    </div>
                )}
                {referee.distance_km === null && (
                    <div className="flex justify-between text-amber-600">
                        <span>Travel</span>
                        <span>Distance unavailable</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-[var(--foreground-muted)]">Booking fee</span>
                    <span className="font-medium">{fmtPrice(BOOKING_FEE_PENCE)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[var(--border-color)] font-semibold">
                    <span>Total to coach</span>
                    <span className="text-green-700">{fmtPrice(totalPence)}</span>
                </div>
            </div>
        )
    }

    return (
        <div className="h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] flex flex-col bg-[var(--neutral-50)]">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[var(--border-color)]">
                <Link href={`/app/bookings/${id}`} className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Matching Referees</h1>
                    <p className="text-[10px] text-[var(--foreground-muted)] uppercase font-bold tracking-wider">
                        Available for your match
                    </p>
                </div>
                <Link href={`/app/bookings/${id}`}>
                    <button className="px-3 py-1.5 text-xs font-bold text-[var(--color-primary)] bg-blue-50 rounded-lg">
                        Skip for now
                    </button>
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-[600px] mx-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Feed-visibility banner — shown above results regardless of how
                        many refs the search returned. Tells the coach whether the
                        booking is also discoverable on the referee feed. */}
                    {!isLoading && feedVisible !== null && (
                        feedVisible ? (
                            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex-shrink-0 flex items-center justify-center">
                                    <Radar className="w-5 h-5 text-emerald-700" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-emerald-900">
                                        Live on the referee feed
                                    </p>
                                    <p className="text-xs text-emerald-800/90 mt-0.5">
                                        This match is now showing for referees within their travel
                                        radius. They&apos;ll tap{' '}
                                        <span className="font-semibold">I&apos;m Available</span> and
                                        you&apos;ll see them appear under Offers — or pick a referee
                                        yourself from the search below.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-amber-100 flex-shrink-0 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-amber-700" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-amber-900">
                                        Not yet on the referee feed
                                    </p>
                                    <p className="text-xs text-amber-800/90 mt-0.5">
                                        We couldn&apos;t pin this booking on the map, so nearby
                                        referees won&apos;t see it. Check the postcode is right —
                                        {' '}
                                        <Link
                                            href={`/app/bookings/${id}/edit`}
                                            className="underline font-semibold hover:no-underline"
                                        >
                                            edit booking
                                        </Link>
                                        {' '}— or send offers manually from the search below.
                                    </p>
                                </div>
                            </div>
                        )
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-[var(--foreground-muted)] font-medium">Finding matching referees...</p>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="space-y-4">
                            {/* Match fee summary — set on the booking itself; tap Edit to change */}
                            {matchFeePounds && matchFeePounds > 0 ? (
                                <div className="bg-white p-4 rounded-xl border border-[var(--border-color)] shadow-sm flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                            <Banknote className="w-5 h-5 text-emerald-700" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--foreground-muted)]">Match fee</p>
                                            <p className="text-lg font-bold text-emerald-700">£{matchFeePounds}</p>
                                            <p className="text-[10px] text-[var(--foreground-muted)] truncate">
                                                Travel ({fmtPrice(travelRatePence)}/km) + £{(BOOKING_FEE_PENCE / 100).toFixed(2)} booking fee added
                                            </p>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/app/bookings/${id}/edit`}
                                        className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-[var(--color-primary)] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        Edit
                                    </Link>
                                </div>
                            ) : (
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                            <Banknote className="w-5 h-5 text-amber-700" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-amber-900">No match fee set</p>
                                            <p className="text-xs text-amber-800">Add one to send offers — refs need to see what they&apos;re paid.</p>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/app/bookings/${id}/edit`}
                                        className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        Add fee
                                    </Link>
                                </div>
                            )}

                            <div className="bg-white p-4 rounded-xl border border-[var(--border-color)] shadow-sm">
                                <p className="text-sm font-medium">
                                    We found <span className="text-[var(--color-primary)] font-bold">{results.length}</span> referees who match your requirements.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {results.map(referee => (
                                    <div key={referee.id} className="relative">
                                        <RefereeSearchResultCard
                                            referee={referee}
                                            onBook={() => handleRequest(referee)}
                                            onViewProfile={(ref) => setSelectedReferee(ref)}
                                        />
                                        {/* Distance + booking fee badges */}
                                        <div className="absolute top-3 right-3 z-[5] flex flex-col items-end gap-1">
                                            {referee.distance_km !== null && (
                                                <div className="flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-semibold text-[var(--foreground-muted)] border border-[var(--border-color)]">
                                                    <MapPin className="w-3 h-3" />
                                                    {referee.distance_km.toFixed(1)} km
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 backdrop-blur-sm rounded-full text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                                                <Receipt className="w-3 h-3" />
                                                Booking fee {fmtPrice(BOOKING_FEE_PENCE)}
                                            </div>
                                        </div>
                                        {/* Cost breakdown below card */}
                                        {matchFeePounds && renderBreakdown(referee)}
                                        {sentRequests.includes(referee.id) && (
                                            <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-10 transition-all animate-in fade-in duration-300">
                                                <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-sm border border-green-200">
                                                    <Check className="w-5 h-5" />
                                                    Request Sent
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-[var(--border-color)] px-6">
                            <div className="w-20 h-20 bg-[var(--neutral-50)] rounded-full flex items-center justify-center mx-auto mb-6">
                                <Search className="w-10 h-10 text-[var(--neutral-300)]" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-xl font-bold mb-2">No matches found</h3>
                            <p className="text-[var(--foreground-muted)] mb-8 max-w-[280px] mx-auto">
                                We couldn&apos;t find any referees matching these specific criteria. Try adjusting the match details.
                            </p>
                            <Link href={`/app/bookings/${id}`}>
                                <button className="w-full py-3 bg-[var(--neutral-100)] text-[var(--foreground)] rounded-xl font-bold">
                                    Back to Booking
                                </button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Modal */}
            {selectedReferee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="relative h-32 bg-[var(--brand-navy)]">
                            <button
                                onClick={() => setSelectedReferee(null)}
                                className="absolute top-3 right-3 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="absolute -bottom-10 left-6 w-20 h-20 rounded-2xl bg-white p-1 shadow-lg">
                                <div className="w-full h-full rounded-xl bg-[var(--neutral-100)] flex items-center justify-center overflow-hidden">
                                    {selectedReferee.avatar_url ? (
                                        <Image src={selectedReferee.avatar_url} alt={selectedReferee.full_name} width={80} height={80} className="w-full h-full object-cover" unoptimized />
                                    ) : (
                                        <span className="text-2xl font-bold text-[var(--neutral-400)]">
                                            {selectedReferee.full_name[0]}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="pt-12 p-6">
                            <h2 className="text-2xl font-bold mb-1">{selectedReferee.full_name}</h2>
                            <p className="text-[var(--foreground-muted)] font-medium mb-1">
                                {selectedReferee.level ? `Level ${selectedReferee.level} Referee` : 'Referee'} - {selectedReferee.county}
                            </p>
                            {selectedReferee.distance_km !== null && (
                                <p className="text-xs text-[var(--foreground-muted)] flex items-center gap-1 mb-4">
                                    <MapPin className="w-3 h-3" /> {selectedReferee.distance_km.toFixed(1)} km from venue
                                </p>
                            )}

                            <div className="mb-4 space-y-2">
                                <div className="bg-[var(--neutral-50)] p-3 rounded-xl border border-[var(--border-color)] flex items-center justify-between">
                                    <p className="text-[10px] uppercase font-bold text-[var(--neutral-400)]">FA Status</p>
                                    <FAStatusBadge status={selectedReferee.fa_verification_status} />
                                </div>
                                <div className="bg-[var(--neutral-50)] p-3 rounded-xl border border-[var(--border-color)] flex items-center justify-between">
                                    <p className="text-[10px] uppercase font-bold text-[var(--neutral-400)]">DBS Check</p>
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                        selectedReferee.dbs_status === 'verified'
                                            ? 'text-green-700'
                                            : selectedReferee.dbs_status === 'expired'
                                            ? 'text-amber-700'
                                            : selectedReferee.dbs_status === 'provided'
                                            ? 'text-blue-700'
                                            : 'text-[var(--neutral-400)]'
                                    }`}>
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        {selectedReferee.dbs_status === 'verified' ? 'Verified'
                                            : selectedReferee.dbs_status === 'expired' ? 'Expired'
                                            : selectedReferee.dbs_status === 'provided' ? 'Provided'
                                            : 'Not Provided'}
                                    </span>
                                </div>
                            </div>

                            {/* Cost breakdown in modal */}
                            {renderBreakdown(selectedReferee)}

                            <button
                                onClick={() => {
                                    handleRequest(selectedReferee)
                                    setSelectedReferee(null)
                                }}
                                disabled={isSubmitting || sentRequests.includes(selectedReferee.id) || !matchFeePounds || matchFeePounds <= 0}
                                className="w-full mt-4 py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {sentRequests.includes(selectedReferee.id) ? 'Request Sent' : matchFeePounds
                                    ? `Send Offer — ${fmtPrice(calcTotalPence(selectedReferee, Math.round(matchFeePounds * 100)))}`
                                    : 'Set a match fee first'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
