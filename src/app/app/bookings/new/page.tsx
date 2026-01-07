'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { WizardContainer } from '@/components/app/StepperWizard'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createBooking } from '../actions'
import { BookingFormData, MatchFormat, CompetitionType } from '@/lib/types'

const steps = [
    { title: 'When', description: 'Date & time' },
    { title: 'Where', description: 'Location' },
    { title: 'Details', description: 'Match info' },
]

const formatOptions = [
    { value: '5v5', label: '5-a-side' },
    { value: '7v7', label: '7-a-side' },
    { value: '9v9', label: '9-a-side' },
    { value: '11v11', label: '11-a-side' },
]

const competitionOptions = [
    { value: 'league', label: 'League Match' },
    { value: 'cup', label: 'Cup Match' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'tournament', label: 'Tournament' },
    { value: 'other', label: 'Other' },
]

const ageGroupOptions = [
    { value: 'u7', label: 'Under 7s' },
    { value: 'u8', label: 'Under 8s' },
    { value: 'u9', label: 'Under 9s' },
    { value: 'u10', label: 'Under 10s' },
    { value: 'u11', label: 'Under 11s' },
    { value: 'u12', label: 'Under 12s' },
    { value: 'u13', label: 'Under 13s' },
    { value: 'u14', label: 'Under 14s' },
    { value: 'u15', label: 'Under 15s' },
    { value: 'u16', label: 'Under 16s' },
    { value: 'u18', label: 'Under 18s' },
    { value: 'adult', label: 'Adult' },
    { value: 'veterans', label: 'Veterans' },
]

export default function NewBookingPage() {
    const router = useRouter()
    const [currentStep, setCurrentStep] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    const [formData, setFormData] = useState<BookingFormData>({
        match_date: '',
        kickoff_time: '',
        location_postcode: '',
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

    const canProceed = () => {
        switch (currentStep) {
            case 0:
                return !!(formData.match_date && formData.kickoff_time)
            case 1:
                return !!formData.location_postcode
            case 2:
                return true // Optional fields
            default:
                return false
        }
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        setError('')

        try {
            const result = await createBooking(formData)
            if (result?.error) {
                setError(result.error)
                setIsSubmitting(false)
            }
            // Redirect happens in the action
        } catch (err) {
            setError('Failed to create booking')
            setIsSubmitting(false)
        }
    }

    return (
        <div className="h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)]">
                <Link href="/app/bookings" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <h1 className="text-lg font-semibold">New Booking</h1>
            </div>

            {error && (
                <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            <WizardContainer
                steps={steps}
                currentStep={currentStep}
                onNext={() => setCurrentStep(prev => prev + 1)}
                onBack={() => setCurrentStep(prev => prev - 1)}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                canProceed={canProceed()}
            >
                {/* Step 1: When */}
                {currentStep === 0 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-semibold mb-1">When is the match?</h2>
                            <p className="text-[var(--foreground-muted)] text-sm">
                                Select the date and kickoff time
                            </p>
                        </div>

                        <Input
                            label="Match Date"
                            type="date"
                            value={formData.match_date}
                            onChange={(e) => updateField('match_date', e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            required
                        />

                        <Input
                            label="Kickoff Time"
                            type="time"
                            value={formData.kickoff_time}
                            onChange={(e) => updateField('kickoff_time', e.target.value)}
                            required
                        />
                    </div>
                )}

                {/* Step 2: Where */}
                {currentStep === 1 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-semibold mb-1">Where is the match?</h2>
                            <p className="text-[var(--foreground-muted)] text-sm">
                                Enter the location details
                            </p>
                        </div>

                        <Input
                            label="Postcode"
                            type="text"
                            value={formData.location_postcode}
                            onChange={(e) => updateField('location_postcode', e.target.value.toUpperCase())}
                            placeholder="SW1A 1AA"
                            required
                        />

                        <Input
                            label="Ground Name (optional)"
                            type="text"
                            value={formData.ground_name || ''}
                            onChange={(e) => updateField('ground_name', e.target.value)}
                            placeholder="e.g. Riverside Playing Fields"
                        />
                    </div>
                )}

                {/* Step 3: Details */}
                {currentStep === 2 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-semibold mb-1">Match Details</h2>
                            <p className="text-[var(--foreground-muted)] text-sm">
                                Add more info to help referees
                            </p>
                        </div>

                        <Select
                            label="Format"
                            options={formatOptions}
                            value={formData.format || ''}
                            onChange={(e) => updateField('format', e.target.value as MatchFormat)}
                            placeholder="Select format"
                        />

                        <Select
                            label="Age Group"
                            options={ageGroupOptions}
                            value={formData.age_group || ''}
                            onChange={(e) => updateField('age_group', e.target.value)}
                            placeholder="Select age group"
                        />

                        <Select
                            label="Competition Type"
                            options={competitionOptions}
                            value={formData.competition_type || ''}
                            onChange={(e) => updateField('competition_type', e.target.value as CompetitionType)}
                            placeholder="Select competition type"
                        />

                        <Input
                            label="Budget (£)"
                            type="number"
                            value={formData.budget_pounds?.toString() || ''}
                            onChange={(e) => updateField('budget_pounds', parseInt(e.target.value) || undefined)}
                            placeholder="40"
                            hint="Optional: suggested fee for the referee"
                        />

                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                                Additional Notes
                            </label>
                            <textarea
                                value={formData.notes || ''}
                                onChange={(e) => updateField('notes', e.target.value)}
                                placeholder="Any special requirements or info..."
                                className="w-full px-3 py-2.5 min-h-[100px] text-base border border-[var(--border-color)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
                            />
                        </div>
                    </div>
                )}
            </WizardContainer>
        </div>
    )
}
