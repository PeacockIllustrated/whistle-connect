'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { searchRefereesForBooking, sendBookingRequest } from '../../actions'
import { RefereeSearchResult } from '@/lib/types'
import { RefereeSearchResultCard } from '@/components/app/RefereeSearchResultCard'
import { StatusChip } from '@/components/ui/StatusChip'

interface Props {
    params: Promise<{ id: string }>
}

export default function BookingMatchPage({ params }: Props) {
    const { id } = use(params)
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [results, setResults] = useState<RefereeSearchResult[]>([])
    const [selectedReferee, setSelectedReferee] = useState<RefereeSearchResult | null>(null)
    const [sentRequests, setSentRequests] = useState<string[]>([])

    useEffect(() => {
        const loadResults = async () => {
            setIsLoading(true)
            try {
                const { data, error } = await searchRefereesForBooking(id)
                if (error) {
                    setError(error)
                } else {
                    setResults(data || [])
                }
            } catch (err) {
                setError('Failed to load matching referees')
            } finally {
                setIsLoading(false)
            }
        }
        loadResults()
    }, [id])

    const handleRequest = async (referee: RefereeSearchResult) => {
        setIsSubmitting(true)
        setError('')

        try {
            const result = await sendBookingRequest(id, referee.id)
            if (result.error) {
                setError(result.error)
                setIsSubmitting(false)
            } else {
                setSentRequests(prev => [...prev, referee.id])
                setIsSubmitting(false)
                // We show a success state on the card rather than redirecting immediately
            }
        } catch (err) {
            setError('Failed to send request')
            setIsSubmitting(false)
        }
    }

    return (
        <div className="h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] flex flex-col bg-[var(--neutral-50)]">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[var(--border-color)]">
                <Link href={`/app/bookings/${id}`} className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
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

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-[var(--foreground-muted)] font-medium">Finding matching referees...</p>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="space-y-4">
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
                                        {sentRequests.includes(referee.id) && (
                                            <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-10 transition-all animate-in fade-in duration-300">
                                                <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-sm border border-green-200">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
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
                                <svg className="w-10 h-10 text-[var(--neutral-300)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
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

            {/* Profile Modal (simplified version of what's in NewBookingPage) */}
            {selectedReferee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="relative h-32 bg-[var(--brand-navy)]">
                            <button
                                onClick={() => setSelectedReferee(null)}
                                className="absolute top-3 right-3 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <div className="absolute -bottom-10 left-6 w-20 h-20 rounded-2xl bg-white p-1 shadow-lg">
                                <div className="w-full h-full rounded-xl bg-[var(--neutral-100)] flex items-center justify-center overflow-hidden">
                                    {selectedReferee.avatar_url ? (
                                        <img src={selectedReferee.avatar_url} alt={selectedReferee.full_name} className="w-full h-full object-cover" />
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
                            <p className="text-[var(--foreground-muted)] font-medium mb-4">
                                {selectedReferee.level ? `Level ${selectedReferee.level} Referee` : 'Referee'} - {selectedReferee.county}
                            </p>

                            <div className="mb-6">
                                <div className="bg-[var(--neutral-50)] p-3 rounded-xl border border-[var(--border-color)] flex items-center justify-between">
                                    <p className="text-[10px] uppercase font-bold text-[var(--neutral-400)]">FA Status</p>
                                    {selectedReferee.fa_verified ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                            FA Verified
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                            FA Unverified
                                        </span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    handleRequest(selectedReferee)
                                    setSelectedReferee(null)
                                }}
                                disabled={isSubmitting || sentRequests.includes(selectedReferee.id)}
                                className="w-full py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {sentRequests.includes(selectedReferee.id) ? 'Request Sent' : 'Send Booking Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
