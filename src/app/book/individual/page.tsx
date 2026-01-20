'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { UK_COUNTIES, AGE_GROUPS, MATCH_FORMATS, COMPETITION_TYPES } from '@/lib/constants'

export default function IndividualBookingPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        county: '',
        match_date: '',
        kickoff_time: '',
        age_group: '',
        home_team: '',
        away_team: '',
        address_text: '',
        location_postcode: '',
        format: '',
        competition_type: '',
    })

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const params = new URLSearchParams({
            type: 'individual',
            ...formData
        })
        router.push(`/app/bookings/new?${params.toString()}`)
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
            <header className="bg-[var(--neutral-900)] text-white py-4 px-4">
                <div className="max-w-[var(--content-max-width)] mx-auto flex items-center gap-3">
                    <Link href="/book" className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <h1 className="text-lg font-semibold tracking-tight">Individual game booking</h1>
                </div>
            </header>

            <main className="flex-1 max-w-[var(--content-max-width)] mx-auto w-full px-4 py-8">
                <div className="bg-white rounded-2xl border border-[var(--border-color)] p-6 shadow-sm">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-2">Match Details</h2>
                        <p className="text-[var(--foreground-muted)] text-sm">
                            Provide full match details to fetch the best referees for your game.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
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

                            <Select
                                label="Age Group"
                                options={AGE_GROUPS}
                                value={formData.age_group}
                                onChange={(e) => updateField('age_group', e.target.value)}
                                placeholder="Select age group"
                                required
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Home Team"
                                    value={formData.home_team}
                                    onChange={(e) => updateField('home_team', e.target.value)}
                                    placeholder="Enter team name"
                                    required
                                />
                                <Input
                                    label="Away Team"
                                    value={formData.away_team}
                                    onChange={(e) => updateField('away_team', e.target.value)}
                                    placeholder="Enter team name"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Address / Ground"
                                    value={formData.address_text}
                                    onChange={(e) => updateField('address_text', e.target.value)}
                                    placeholder="e.g. Wembley Stadium"
                                    required
                                />
                                <Input
                                    label="Postcode"
                                    value={formData.location_postcode}
                                    onChange={(e) => updateField('location_postcode', e.target.value.toUpperCase())}
                                    placeholder="e.g. SW1A 1AA"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select
                                    label="Match Format"
                                    options={MATCH_FORMATS}
                                    value={formData.format}
                                    onChange={(e) => updateField('format', e.target.value)}
                                    placeholder="Select format"
                                    required
                                />
                                <Select
                                    label="Competition"
                                    options={COMPETITION_TYPES}
                                    value={formData.competition_type}
                                    onChange={(e) => updateField('competition_type', e.target.value)}
                                    placeholder="Select type"
                                    required
                                />
                            </div>
                        </div>

                        <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold bg-[var(--wc-blue)] hover:bg-[#1e1c45] text-white">
                            Continue to Booking
                        </Button>
                    </form>
                </div>
            </main>
        </div>
    )
}
