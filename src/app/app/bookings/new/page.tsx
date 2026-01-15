'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { searchReferees, bookReferee } from '../actions'
import { BookingFormData, MatchFormat, CompetitionType, SearchCriteria, RefereeSearchResult } from '@/lib/types'
import { UK_COUNTIES, MATCH_FORMATS, COMPETITION_TYPES, AGE_GROUPS } from '@/lib/constants'
import { RefereeSearchResultCard } from '@/components/app/RefereeSearchResultCard'
import { StatusChip } from '@/components/ui/StatusChip'

export default function NewBookingPage() {
    const router = useRouter()
    const [view, setView] = useState<'SEARCH' | 'RESULTS'>('SEARCH')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [results, setResults] = useState<RefereeSearchResult[]>([])
    const [selectedReferee, setSelectedReferee] = useState<RefereeSearchResult | null>(null)

    const [formData, setFormData] = useState<BookingFormData>({
        match_date: '',
        kickoff_time: '',
        location_postcode: '',
        county: '',
        ground_name: '',
        age_group: '',
        format: undefined,
        competition_type: undefined,
        notes: '',
        budget_pounds: undefined,
    })

    const updateField = <K extends keyof BookingFormData>(
        field: K,
        value: BookingFormData[K]
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError('')

        const criteria: SearchCriteria = {
            county: formData.county || '',
            match_date: formData.match_date,
            kickoff_time: formData.kickoff_time,
            age_group: formData.age_group || '',
            format: formData.format as MatchFormat,
            competition_type: formData.competition_type as CompetitionType,
        }

        try {
            const { data, error } = await searchReferees(criteria)
            if (error) {
                setError(error)
            } else {
                setResults(data || [])
                setView('RESULTS')
            }
        } catch (err) {
            setError('Failed to search referees')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleBook = async (referee: RefereeSearchResult) => {
        setIsSubmitting(true)
        setError('')

        try {
            const { threadId, error } = await bookReferee(referee.id, formData)
            if (error) {
                setError(error)
                setIsSubmitting(false)
            } else if (threadId) {
                router.push(`/app/messages/${threadId}`)
            }
        } catch (err) {
            setError('Failed to book referee')
            setIsSubmitting(false)
        }
    }

    return (
        <div className="h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] flex flex-col bg-[var(--neutral-50)]">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[var(--border-color)]">
                {view === 'RESULTS' ? (
                    <button
                        onClick={() => setView('SEARCH')}
                        className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                ) : (
                    <Link href="/app/bookings" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                )}
                <h1 className="text-lg font-semibold">
                    {view === 'SEARCH' ? 'Book a Referee' : 'Available Referees'}
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-[600px] mx-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {view === 'SEARCH' && (
                        <form onSubmit={handleSearch} className="space-y-6">
                            <div className="bg-white rounded-2xl border border-[var(--border-color)] p-6 space-y-6 shadow-sm">
                                <div>
                                    <h2 className="text-xl font-bold mb-1">Match Details</h2>
                                    <p className="text-[var(--foreground-muted)] text-sm">
                                        Tell us where and when, and we'll find matching referees.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-6">
                                    <Select
                                        label="County"
                                        options={UK_COUNTIES.map(c => ({ value: c, label: c }))}
                                        value={formData.county}
                                        onChange={(e) => updateField('county', e.target.value)}
                                        placeholder="Select county"
                                        required
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Match Date"
                                            type="date"
                                            value={formData.match_date}
                                            onChange={(e) => updateField('match_date', e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                            required
                                        />
                                        <Input
                                            label="Kickoff"
                                            type="time"
                                            value={formData.kickoff_time}
                                            onChange={(e) => updateField('kickoff_time', e.target.value)}
                                            required
                                        />
                                    </div>

                                    <Input
                                        label="Postcode"
                                        type="text"
                                        value={formData.location_postcode}
                                        onChange={(e) => updateField('location_postcode', e.target.value.toUpperCase())}
                                        placeholder="SW1A 1AA"
                                        required
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <Select
                                            label="Age Group"
                                            options={AGE_GROUPS}
                                            value={formData.age_group}
                                            onChange={(e) => updateField('age_group', e.target.value)}
                                            placeholder="Select"
                                            required
                                        />
                                        <Select
                                            label="Format"
                                            options={MATCH_FORMATS}
                                            value={formData.format || ''}
                                            onChange={(e) => updateField('format', e.target.value as MatchFormat)}
                                            placeholder="Select"
                                            required
                                        />
                                    </div>

                                    <Select
                                        label="Competition Type"
                                        options={COMPETITION_TYPES}
                                        value={formData.competition_type || ''}
                                        onChange={(e) => updateField('competition_type', e.target.value as CompetitionType)}
                                        placeholder="Select competition type"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold shadow-lg shadow-blue-900/10 hover:opacity-90 transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? 'Searching...' : 'Search Referees'}
                            </button>
                        </form>
                    )}

                    {view === 'RESULTS' && (
                        <div className="space-y-4">
                            <div className="bg-[var(--neutral-100)] p-3 rounded-xl flex items-center justify-between">
                                <span className="text-sm font-medium text-[var(--foreground-muted)]">
                                    {results.length} results for {formData.county}
                                </span>
                                <button
                                    onClick={() => setView('SEARCH')}
                                    className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider"
                                >
                                    Edit Search
                                </button>
                            </div>

                            {results.length > 0 ? (
                                <div className="space-y-3">
                                    {results.map(referee => (
                                        <RefereeSearchResultCard
                                            key={referee.id}
                                            referee={referee}
                                            onBook={handleBook}
                                            onViewProfile={(ref) => setSelectedReferee(ref)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-[var(--border-color)]">
                                    <div className="w-16 h-16 bg-[var(--neutral-50)] rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-[var(--neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold mb-1">No matches found</h3>
                                    <p className="text-[var(--foreground-muted)] text-sm mb-6 max-w-[240px] mx-auto">
                                        Try widening your search criteria or changing the date.
                                    </p>
                                    <button
                                        onClick={() => setView('SEARCH')}
                                        className="px-6 py-2 bg-[var(--neutral-100)] text-[var(--foreground)] rounded-lg font-medium text-sm"
                                    >
                                        Back to Search
                                    </button>
                                </div>
                            )}
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
                                {selectedReferee.level ? `Level ${selectedReferee.level} Referee` : 'Referee'} • {selectedReferee.county}
                            </p>

                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-[var(--neutral-50)] p-3 rounded-xl border border-[var(--border-color)]">
                                    <p className="text-[10px] uppercase font-bold text-[var(--neutral-400)] mb-1">DBS Status</p>
                                    <StatusChip status={selectedReferee.dbs_status} />
                                </div>
                                <div className="bg-[var(--neutral-50)] p-3 rounded-xl border border-[var(--border-color)]">
                                    <p className="text-[10px] uppercase font-bold text-[var(--neutral-400)] mb-1">Safeguarding</p>
                                    <StatusChip status={selectedReferee.safeguarding_status} />
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-semibold">Travel Radius</p>
                                        <p className="text-[var(--foreground-muted)]">{selectedReferee.travel_radius_km}km from home base</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    handleBook(selectedReferee)
                                    setSelectedReferee(null)
                                }}
                                disabled={isSubmitting}
                                className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {isSubmitting ? 'Booking...' : 'Book Referee'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
