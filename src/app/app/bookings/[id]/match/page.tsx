'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { searchRefereesForBooking, sendBookingRequest } from '../../actions'
import { RefereeSearchResult } from '@/lib/types'
import { RefereeSearchResultCard } from '@/components/app/RefereeSearchResultCard'
import { FAStatusBadge } from '@/components/ui/FAStatusBadge'
import Image from 'next/image'
import { ChevronLeft, Check, Search, X, ShieldCheck } from 'lucide-react'

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
    const [offerPrice, setOfferPrice] = useState('')

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
            } catch {
                setError('Failed to load matching referees')
            } finally {
                setIsLoading(false)
            }
        }
        loadResults()
    }, [id])

    const handleRequest = async (referee: RefereeSearchResult) => {
        const priceNum = parseFloat(offerPrice)
        if (isNaN(priceNum) || priceNum <= 0) {
            setError('Please enter a valid offer price above')
            return
        }

        setIsSubmitting(true)
        setError('')

        try {
            const result = await sendBookingRequest(id, referee.id, priceNum)
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

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-[var(--foreground-muted)] font-medium">Finding matching referees...</p>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="space-y-4">
                            {/* Price input — applies to all offers */}
                            <div className="bg-white p-4 rounded-xl border border-[var(--border-color)] shadow-sm space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">💰</span>
                                    <p className="text-sm font-semibold">Your offer price</p>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] font-medium">&pound;</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={offerPrice}
                                        onChange={(e) => {
                                            setOfferPrice(e.target.value)
                                            setError('')
                                        }}
                                        className="w-full pl-7 pr-3 py-3 bg-[var(--neutral-50)] border border-[var(--border-color)] rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                                        step="0.01"
                                        min="1"
                                        max="500"
                                    />
                                </div>
                                <p className="text-[10px] text-[var(--foreground-muted)]">
                                    This price will be offered to all referees you send requests to. Include travel and expenses.
                                </p>
                            </div>

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

            {/* Profile Modal (simplified version of what's in NewBookingPage) */}
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
                            <p className="text-[var(--foreground-muted)] font-medium mb-4">
                                {selectedReferee.level ? `Level ${selectedReferee.level} Referee` : 'Referee'} - {selectedReferee.county}
                            </p>

                            <div className="mb-6 space-y-2">
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

                            <button
                                onClick={() => {
                                    handleRequest(selectedReferee)
                                    setSelectedReferee(null)
                                }}
                                disabled={isSubmitting || sentRequests.includes(selectedReferee.id) || !offerPrice || parseFloat(offerPrice) <= 0}
                                className="w-full py-4 bg-[var(--color-primary)] text-white rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {sentRequests.includes(selectedReferee.id) ? 'Request Sent' : offerPrice ? `Send Offer — £${parseFloat(offerPrice).toFixed(2)}` : 'Set a price first'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
