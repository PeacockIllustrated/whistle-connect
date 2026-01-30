'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createBooking } from '../actions'
import { BookingFormData, MatchFormat, CompetitionType } from '@/lib/types'
import { UK_COUNTIES, MATCH_FORMATS, COMPETITION_TYPES, AGE_GROUPS } from '@/lib/constants'

export default function NewBookingPage() {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    const [formData, setFormData] = useState<BookingFormData>(() => {
        if (typeof window === 'undefined') return {
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
        }

        const params = new URLSearchParams(window.location.search)
        return {
            match_date: params.get('match_date') || params.get('date') || '',
            kickoff_time: params.get('kickoff_time') || '',
            location_postcode: params.get('location_postcode') || '',
            county: params.get('county') || '',
            ground_name: params.get('ground_name') || params.get('address_text') || '',
            age_group: params.get('age_group') || '',
            format: (params.get('format') as MatchFormat) || undefined,
            competition_type: (params.get('competition_type') as CompetitionType) || undefined,
            home_team: params.get('home_team') || '',
            away_team: params.get('away_team') || '',
            address_text: params.get('address_text') || '',
            notes: params.get('notes') || '',
            budget_pounds: params.get('budget_pounds') ? parseInt(params.get('budget_pounds')!) : undefined,
            booking_type: (params.get('type') as any) || 'individual',
        }
    })

    // Determine if we should show the "Review" mode vs "Edit" mode
    const isPreFilled = formData.match_date && formData.kickoff_time && formData.location_postcode && formData.county

    const updateField = <K extends keyof BookingFormData>(
        field: K,
        value: BookingFormData[K]
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()

        // Prevent autofill-triggered submission
        if (isSubmitting) return

        setIsSubmitting(true)
        setError('')

        try {
            const result = await createBooking(formData)
            if (result?.error) {
                setError(result.error)
                setIsSubmitting(false)
            }
        } catch (err) {
            setError('Failed to create booking')
            setIsSubmitting(false)
        }
    }

    // Prevent form submission on Enter key in input fields (prevents autofill auto-submit)
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
            e.preventDefault()
        }
    }

    return (
        <div className="h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] flex flex-col bg-[var(--neutral-50)]">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[var(--border-color)]">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <h1 className="text-lg font-semibold">
                    {isPreFilled ? 'Confirm Booking Details' : 'New Booking'}
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-[600px] mx-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleCreate} onKeyDown={handleKeyDown} className="space-y-6">
                        <div className="bg-white rounded-2xl border border-[var(--border-color)] p-6 space-y-6 shadow-sm">
                            {isPreFilled ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-xl font-bold mb-1">Review Details</h2>
                                            <p className="text-[var(--foreground-muted)] text-sm">
                                                Please confirm these details are correct.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => window.history.back()}
                                            className="text-sm font-semibold text-[var(--color-primary)] px-3 py-1 bg-blue-50 rounded-lg"
                                        >
                                            Edit
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 pt-2">
                                        <div className="p-3 bg-[var(--neutral-50)] rounded-xl border border-[var(--border-color)]">
                                            <p className="text-[10px] uppercase font-bold text-[var(--neutral-400)] mb-1">Match Date & Time</p>
                                            <p className="font-medium">{formData.match_date} @ {formData.kickoff_time}</p>
                                        </div>
                                        <div className="p-3 bg-[var(--neutral-50)] rounded-xl border border-[var(--border-color)]">
                                            <p className="text-[10px] uppercase font-bold text-[var(--neutral-400)] mb-1">Teams</p>
                                            <p className="font-medium">
                                                {formData.home_team || 'Home'} vs {formData.away_team || 'Away'}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--neutral-50)] rounded-xl border border-[var(--border-color)]">
                                            <p className="text-[10px] uppercase font-bold text-[var(--neutral-400)] mb-1">Location</p>
                                            <p className="font-medium">{formData.address_text || formData.ground_name}</p>
                                            <p className="text-sm text-[var(--foreground-muted)]">{formData.location_postcode}, {formData.county}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 bg-[var(--neutral-50)] rounded-xl border border-[var(--border-color)]">
                                                <p className="text-[10px] uppercase font-bold text-[var(--neutral-400)] mb-1">Age & Format</p>
                                                <p className="font-medium text-sm">{formData.age_group} • {formData.format}</p>
                                            </div>
                                            <div className="p-3 bg-[var(--neutral-50)] rounded-xl border border-[var(--border-color)]">
                                                <p className="text-[10px] uppercase font-bold text-[var(--neutral-400)] mb-1">Competition</p>
                                                <p className="font-medium text-sm capitalize">{formData.competition_type}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-[var(--border-color)]">
                                        <Input
                                            label="Additional Notes (Optional)"
                                            value={formData.notes || ''}
                                            onChange={(e) => updateField('notes', e.target.value)}
                                            placeholder="e.g. Bring a whistle..."
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <h2 className="text-xl font-bold mb-1">Match Details</h2>
                                        <p className="text-[var(--foreground-muted)] text-sm">
                                            Almost there! Add the remaining details to find your referee.
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

                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="Home Team"
                                                value={formData.home_team || ''}
                                                onChange={(e) => updateField('home_team', e.target.value)}
                                                placeholder="Optional"
                                            />
                                            <Input
                                                label="Away Team"
                                                value={formData.away_team || ''}
                                                onChange={(e) => updateField('away_team', e.target.value)}
                                                placeholder="Optional"
                                            />
                                        </div>

                                        <Input
                                            label="Address / Ground"
                                            value={formData.address_text || ''}
                                            onChange={(e) => updateField('address_text', e.target.value)}
                                            placeholder="e.g. Wembley Stadium or SW1A 1AA"
                                        />

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

                                        <Input
                                            label="Notes for Referee"
                                            value={formData.notes || ''}
                                            onChange={(e) => updateField('notes', e.target.value)}
                                            placeholder="Any extra info..."
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-[var(--wc-red)] text-white rounded-xl font-bold shadow-lg shadow-red-900/10 hover:opacity-90 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Creating Booking...' : (isPreFilled ? 'Confirm & Find Referees' : 'Find Matching Referees')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
