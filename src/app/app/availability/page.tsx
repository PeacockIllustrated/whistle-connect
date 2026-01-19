'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MonthCalendar } from '@/components/app/MonthCalendar'
import { TimeBandSelector, TIME_BANDS } from '@/components/app/TimeBandSelector'
import { Button } from '@/components/ui/Button'
import { getDateAvailability, updateDateAvailability, getRefereeProfile, updateRefereeProfile } from './actions'
import { RefereeDateAvailability } from '@/lib/types'
import { Select } from '@/components/ui/Select'
import { UK_COUNTIES } from '@/lib/constants'

export default function AvailabilityPage() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [dateAvailability, setDateAvailability] = useState<RefereeDateAvailability[]>([])
    const [centralVenueOptIn, setCentralVenueOptIn] = useState(false)
    const [initialOptIn, setInitialOptIn] = useState(false)
    const [county, setCounty] = useState('')
    const [initialCounty, setInitialCounty] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        loadDateAvailability(selectedDate)
    }, [selectedDate])

    async function loadInitialData() {
        setLoading(true)
        const profileResult = await getRefereeProfile()
        if (profileResult.data) {
            setCentralVenueOptIn(profileResult.data.central_venue_opt_in)
            setInitialOptIn(profileResult.data.central_venue_opt_in)
            setCounty(profileResult.data.county || '')
            setInitialCounty(profileResult.data.county || '')
        }
        setLoading(false)
    }

    async function loadDateAvailability(date: Date) {
        const dateStr = date.toISOString().split('T')[0]
        const result = await getDateAvailability(dateStr)
        if (result.data) {
            setDateAvailability(result.data)
        } else {
            setDateAvailability([])
        }
        setHasChanges(false)
    }

    const toggleBand = (startTime: string) => {
        const isSelected = dateAvailability.some(a => a.start_time === startTime + ':00')
        let newAvail = [...dateAvailability]

        if (isSelected) {
            newAvail = newAvail.filter(a => a.start_time !== startTime + ':00')
        } else {
            const band = TIME_BANDS.find(b => b.start === startTime)
            if (band) {
                newAvail.push({
                    start_time: band.start + ':00',
                    end_time: band.end + ':00',
                } as RefereeDateAvailability)
            }
        }

        setDateAvailability(newAvail)
        setHasChanges(true)
    }

    async function handleSave() {
        setSaving(true)
        setMessage(null)

        try {
            const dateStr = selectedDate.toISOString().split('T')[0]
            const slots = dateAvailability.map(a => ({
                start_time: a.start_time,
                end_time: a.end_time
            }))

            const results = await Promise.all([
                updateDateAvailability(dateStr, slots),
                (centralVenueOptIn !== initialOptIn || county !== initialCounty)
                    ? updateRefereeProfile({
                        central_venue_opt_in: centralVenueOptIn,
                        county: county
                    })
                    : Promise.resolve({ success: true })
            ])

            const errorObj = results.find(r => 'error' in r && r.error)
            if (errorObj && 'error' in errorObj) {
                setMessage({ type: 'error', text: errorObj.error as string })
            } else {
                setMessage({ type: 'success', text: 'Availability updated!' })
                setHasChanges(false)
                setInitialOptIn(centralVenueOptIn)
                setInitialCounty(county)
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update availability' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Referee Availability</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Manage your calendar and time slots
                    </p>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-xl mb-6 shadow-sm ${message.type === 'success'
                    ? 'bg-green-50 border border-green-100 text-green-800'
                    : 'bg-red-50 border border-red-100 text-red-800'
                    }`}>
                    <div className="flex items-center gap-2">
                        {message.type === 'success' ? (
                            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        <span className="font-medium text-sm">{message.text}</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
                <div className="space-y-8">
                    {/* Calendar Section */}
                    <div className="card overflow-hidden">
                        <div className="p-4 border-b border-[var(--border-color)] bg-[var(--neutral-50)]">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)]">SELECT DATE</h2>
                        </div>
                        <div className="p-6">
                            <MonthCalendar
                                selectedDate={selectedDate}
                                onDateSelect={setSelectedDate}
                            />
                        </div>
                    </div>

                    {/* Time Bands Section */}
                    <div className="card overflow-hidden">
                        <div className="p-4 border-b border-[var(--border-color)] bg-[var(--neutral-50)] flex items-center justify-between">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                                SLOTS: {selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                            </h2>
                        </div>
                        <div className="p-6">
                            <TimeBandSelector
                                selectedBands={dateAvailability.map(a => a.start_time.slice(0, 5))}
                                onToggle={toggleBand}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Settings Section */}
                    <div className="card overflow-hidden">
                        <div className="p-4 border-b border-[var(--border-color)] bg-[var(--neutral-50)]">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)]">SETTINGS</h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="text-xs font-bold text-[var(--foreground-muted)] uppercase mb-3 block">LOCATION</label>
                                <Select
                                    label="Primary County"
                                    options={UK_COUNTIES.map(c => ({ value: c, label: c }))}
                                    value={county}
                                    onChange={(e) => {
                                        setCounty(e.target.value)
                                        setHasChanges(true)
                                    }}
                                    placeholder="Select county"
                                />
                                <p className="text-[10px] text-[var(--foreground-muted)] mt-2 italic">
                                    Helps coaches find you in their area.
                                </p>
                            </div>

                            <hr className="border-[var(--border-color)]" />

                            <div className="flex items-start gap-3 bg-[var(--neutral-50)] p-4 rounded-xl border border-[var(--border-color)]">
                                <div className="pt-1">
                                    <input
                                        type="checkbox"
                                        id="central_venue_opt_in"
                                        checked={centralVenueOptIn}
                                        onChange={(e) => {
                                            setCentralVenueOptIn(e.target.checked)
                                            setHasChanges(true)
                                        }}
                                        className="w-5 h-5 rounded border-[var(--border-color)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)] cursor-pointer"
                                    />
                                </div>
                                <label htmlFor="central_venue_opt_in" className="text-sm cursor-pointer select-none">
                                    <span className="font-bold block text-[var(--foreground)]">Central Venue Opt-in</span>
                                    <span className="text-xs text-[var(--foreground-muted)]">I am available for multi-game bookings at central venues</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="sticky bottom-6 lg:static">
                        <Button
                            fullWidth
                            size="lg"
                            onClick={handleSave}
                            loading={saving}
                            disabled={!hasChanges && centralVenueOptIn === initialOptIn && county === initialCounty}
                            className="shadow-lg"
                        >
                            Update Availability
                        </Button>
                        <p className="text-[10px] text-center mt-3 text-[var(--foreground-muted)]">
                            * Changes apply only to the selected date and settings
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
