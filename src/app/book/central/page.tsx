'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { UK_COUNTIES } from '@/lib/constants'
import { createBooking } from '@/app/app/bookings/actions'

export default function CentralBookingPage() {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [formData, setFormData] = useState({
        county: '',
        match_date: '',
        kickoff_time: '',
        location_postcode: '',
        address_text: '',
        notes: '',
    })

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    // Prevent Enter key from submitting form (stops autofill auto-submit)
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) {
            e.preventDefault()
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (isSubmitting) return

        setIsSubmitting(true)
        setError('')

        try {
            const result = await createBooking({
                match_date: formData.match_date,
                kickoff_time: formData.kickoff_time,
                location_postcode: formData.location_postcode,
                county: formData.county,
                ground_name: formData.address_text,
                address_text: formData.address_text,
                notes: formData.notes,
                booking_type: 'central',
            })
            if (result?.error) {
                setError(result.error)
                setIsSubmitting(false)
            }
            // On success, createBooking redirects to the match page automatically
        } catch (err) {
            setError('Failed to create booking')
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
            <header className="bg-[var(--neutral-900)] text-white py-4 px-4">
                <div className="max-w-[var(--content-max-width)] mx-auto flex items-center gap-3">
                    <Link href="/book" className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-lg font-semibold tracking-tight">Central Venue Booking</h1>
                </div>
            </header>

            <main className="flex-1 max-w-[var(--content-max-width)] mx-auto w-full px-4 py-8">
                <div className="bg-white rounded-2xl border border-[var(--border-color)] p-6 shadow-sm">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-2">Event Details</h2>
                        <p className="text-[var(--foreground-muted)] text-sm">
                            Enter the details for your central venue event to find available referees.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} autoComplete="off" className="space-y-6">
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
                                    label="Event Date"
                                    type="date"
                                    value={formData.match_date}
                                    onChange={(e) => updateField('match_date', e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    required
                                />
                                <Input
                                    label="Start Time"
                                    type="time"
                                    value={formData.kickoff_time}
                                    onChange={(e) => updateField('kickoff_time', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Venue Name"
                                    value={formData.address_text}
                                    onChange={(e) => updateField('address_text', e.target.value)}
                                    placeholder="e.g. Northumberland Park"
                                    autoComplete="off"
                                    required
                                />
                                <Input
                                    label="Postcode"
                                    value={formData.location_postcode}
                                    onChange={(e) => updateField('location_postcode', e.target.value.toUpperCase())}
                                    placeholder="e.g. NE1 4ST"
                                    autoComplete="off"
                                    required
                                />
                            </div>

                            <Input
                                label="Notes (Optional)"
                                value={formData.notes}
                                onChange={(e) => updateField('notes', e.target.value)}
                                placeholder="e.g. Number of pitches, expected games..."
                            />
                        </div>

                        <Button
                            type="submit"
                            size="lg"
                            loading={isSubmitting}
                            disabled={isSubmitting}
                            className="w-full h-14 text-lg font-bold bg-[var(--wc-red)] hover:bg-[#a11214] text-white"
                        >
                            {isSubmitting ? 'Creating Booking...' : 'Find Available Referees'}
                        </Button>
                    </form>
                </div>
            </main>
        </div>
    )
}
