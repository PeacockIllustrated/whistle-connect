'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { getBooking, updateBooking } from '../../actions'
import { BookingFormData, MatchFormat, CompetitionType } from '@/lib/types'
import { UK_COUNTIES, MATCH_FORMATS, COMPETITION_TYPES, AGE_GROUPS } from '@/lib/constants'
import { use } from 'react'
import { ChevronLeft } from 'lucide-react'

export default function EditBookingPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')

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

    useEffect(() => {
        async function loadBooking() {
            const result = await getBooking(id)
            if (result.data) {
                setFormData({
                    match_date: result.data.match_date || '',
                    kickoff_time: result.data.kickoff_time?.slice(0, 5) || '',
                    location_postcode: result.data.location_postcode || '',
                    county: result.data.county || '',
                    ground_name: result.data.ground_name || '',
                    age_group: result.data.age_group || '',
                    format: result.data.format || undefined,
                    competition_type: result.data.competition_type || undefined,
                    home_team: result.data.home_team || '',
                    away_team: result.data.away_team || '',
                    address_text: result.data.address_text || '',
                    notes: result.data.notes || '',
                    budget_pounds: result.data.budget_pounds || undefined,
                })
            } else if (result.error) {
                setError(result.error)
            }
            setIsLoading(false)
        }
        loadBooking()
    }, [id])

    const updateField = <K extends keyof BookingFormData>(
        field: K,
        value: BookingFormData[K]
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isSubmitting) return

        setIsSubmitting(true)
        setError('')

        try {
            const result = await updateBooking(id, formData)
            if (result?.error) {
                setError(result.error)
                setIsSubmitting(false)
            } else {
                router.push(`/app/bookings/${id}`)
            }
        } catch (err) {
            setError('Failed to update booking')
            setIsSubmitting(false)
        }
    }

    // Prevent form submission on Enter key in input fields
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
            e.preventDefault()
        }
    }

    if (isLoading) {
        return (
            <div className="h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin" />
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
                <h1 className="text-lg font-semibold">Edit Booking</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-[600px] mx-auto">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleUpdate} onKeyDown={handleKeyDown} className="space-y-6">
                        <div className="bg-white rounded-2xl border border-[var(--border-color)] p-6 space-y-6 shadow-sm">
                            <div>
                                <h2 className="text-xl font-bold mb-1">Match Details</h2>
                                <p className="text-[var(--foreground-muted)] text-sm">
                                    Update your booking details below.
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
                        </div>

                        <div className="flex gap-3">
                            <Link href={`/app/bookings/${id}`} className="flex-1">
                                <Button type="button" fullWidth variant="outline">
                                    Cancel
                                </Button>
                            </Link>
                            <Button
                                type="submit"
                                fullWidth
                                loading={isSubmitting}
                                className="flex-1"
                            >
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
