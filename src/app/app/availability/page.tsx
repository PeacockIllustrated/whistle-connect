'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MonthCalendar } from '@/components/app/MonthCalendar'
import { TimeBandSelector, TIME_BANDS } from '@/components/app/TimeBandSelector'
import { Button } from '@/components/ui/Button'
import { getDateAvailability, updateDateAvailability, getRefereeProfile, updateRefereeProfile, getUserProfile, getAvailability } from './actions'
import { RefereeDateAvailability, UserRole } from '@/lib/types'
import { Select } from '@/components/ui/Select'
import { UK_COUNTIES } from '@/lib/constants'
import { RoleAccessDenied } from '@/components/app/RoleAccessDenied'
import { ChevronLeft, Check, AlertCircle, CalendarDays, ChevronDown } from 'lucide-react'

export default function AvailabilityPage() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [selectedDates, setSelectedDates] = useState<Date[]>([])
    const [multiSelectMode, setMultiSelectMode] = useState(false)
    const [dateAvailability, setDateAvailability] = useState<RefereeDateAvailability[]>([])
    const [centralVenueOptIn, setCentralVenueOptIn] = useState(false)
    const [initialOptIn, setInitialOptIn] = useState(false)
    const [county, setCounty] = useState('')
    const [initialCounty, setInitialCounty] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [userRole, setUserRole] = useState<UserRole | null>(null)
    const [accessDenied, setAccessDenied] = useState(false)
    const [allAvailability, setAllAvailability] = useState<RefereeDateAvailability[]>([])
    const [accordionOpen, setAccordionOpen] = useState(false)

    useEffect(() => {
        loadInitialData()
    }, [])

    useEffect(() => {
        if (!multiSelectMode) {
            loadDateAvailability(selectedDate)
        }
    }, [selectedDate, multiSelectMode])

    async function loadInitialData() {
        setLoading(true)

        // Check user role first
        const userProfileResult = await getUserProfile()
        if (userProfileResult.data) {
            setUserRole(userProfileResult.data.role as UserRole)
            if (userProfileResult.data.role !== 'referee') {
                setAccessDenied(true)
                setLoading(false)
                return
            }
        }

        const profileResult = await getRefereeProfile()
        if (profileResult.data) {
            setCentralVenueOptIn(profileResult.data.central_venue_opt_in)
            setInitialOptIn(profileResult.data.central_venue_opt_in)
            setCounty(profileResult.data.county || '')
            setInitialCounty(profileResult.data.county || '')
        }

        // Load all availability for the accordion
        await loadAllAvailability()

        setLoading(false)
    }

    async function loadAllAvailability() {
        const result = await getAvailability()
        if (result.data) {
            setAllAvailability(result.data)
        }
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
            const slots = dateAvailability.map(a => ({
                start_time: a.start_time,
                end_time: a.end_time
            }))

            // In multi-select mode, update all selected dates
            if (multiSelectMode && selectedDates.length > 0) {
                const dateUpdatePromises = selectedDates.map(date => {
                    const dateStr = date.toISOString().split('T')[0]
                    return updateDateAvailability(dateStr, slots)
                })

                const results = await Promise.all([
                    ...dateUpdatePromises,
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
                    setMessage({ type: 'success', text: `Availability updated for ${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''}!` })
                    setHasChanges(false)
                    setInitialOptIn(centralVenueOptIn)
                    setInitialCounty(county)
                    setSelectedDates([])
                    await loadAllAvailability()
                }
            } else {
                // Single date mode
                const dateStr = selectedDate.toISOString().split('T')[0]

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
                    await loadAllAvailability()
                }
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update availability' })
        } finally {
            setSaving(false)
        }
    }

    // Handle toggling multi-select mode
    const handleModeToggle = () => {
        if (multiSelectMode) {
            // Switching back to single mode - clear multi-selection
            setSelectedDates([])
            setDateAvailability([])
            loadDateAvailability(selectedDate)
        } else {
            // Switching to multi mode - clear single date availability to start fresh
            setDateAvailability([])
        }
        setMultiSelectMode(!multiSelectMode)
        setHasChanges(false)
    }

    // Show access denied for non-referees
    if (accessDenied) {
        return (
            <RoleAccessDenied
                requiredRole="referee"
                currentRole={userRole || undefined}
                featureName="Availability Management"
                description="This feature is for referees to manage their availability. Coaches can view referee availability when booking."
            />
        )
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
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
                            <Check className="w-5 h-5 text-green-500" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                        <span className="font-medium text-sm">{message.text}</span>
                    </div>
                </div>
            )}

            {/* Settings Section - County & Central Venue */}
            <div className="card overflow-hidden mb-8">
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

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
                <div className="space-y-8">
                    {/* Calendar Section */}
                    <div className="card overflow-hidden">
                        <div className="p-4 border-b border-[var(--border-color)] bg-[var(--neutral-50)] flex items-center justify-between">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                                SELECT DATE{multiSelectMode ? 'S' : ''}
                            </h2>
                            {/* Selection Mode Toggle */}
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium transition-colors ${!multiSelectMode ? 'text-[var(--foreground)]' : 'text-[var(--foreground-muted)]'}`}>
                                    Single
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={multiSelectMode}
                                    onClick={handleModeToggle}
                                    className={`
                                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out
                                        focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-offset-2
                                        ${multiSelectMode ? 'bg-[var(--brand-primary)]' : 'bg-[var(--neutral-300)]'}
                                    `}
                                >
                                    <span
                                        className={`
                                            inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out
                                            ${multiSelectMode ? 'translate-x-6' : 'translate-x-1'}
                                        `}
                                    />
                                </button>
                                <span className={`text-xs font-medium transition-colors ${multiSelectMode ? 'text-[var(--foreground)]' : 'text-[var(--foreground-muted)]'}`}>
                                    Multi
                                </span>
                            </div>
                        </div>
                        <div className="p-6">
                            {multiSelectMode ? (
                                <>
                                    <MonthCalendar
                                        multiSelect
                                        selectedDates={selectedDates}
                                        onDatesSelect={(dates) => {
                                            setSelectedDates(dates)
                                            setHasChanges(dates.length > 0)
                                        }}
                                    />
                                    {selectedDates.length > 0 && (
                                        <div className="mt-4 p-3 bg-[var(--neutral-50)] rounded-lg border border-[var(--border-color)]">
                                            <p className="text-xs font-medium text-[var(--foreground-muted)] mb-2">
                                                {selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} selected
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {selectedDates
                                                    .sort((a, b) => a.getTime() - b.getTime())
                                                    .slice(0, 5)
                                                    .map((date, i) => (
                                                        <span
                                                            key={i}
                                                            className="text-[10px] bg-[var(--brand-primary)] text-white px-2 py-0.5 rounded-full"
                                                        >
                                                            {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    ))}
                                                {selectedDates.length > 5 && (
                                                    <span className="text-[10px] bg-[var(--neutral-200)] text-[var(--foreground-muted)] px-2 py-0.5 rounded-full">
                                                        +{selectedDates.length - 5} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <MonthCalendar
                                    selectedDate={selectedDate}
                                    onDateSelect={setSelectedDate}
                                />
                            )}
                        </div>
                    </div>

                    {/* Time Bands Section */}
                    <div className="card overflow-hidden">
                        <div className="p-4 border-b border-[var(--border-color)] bg-[var(--neutral-50)] flex items-center justify-between">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                                {multiSelectMode
                                    ? selectedDates.length > 0
                                        ? `SLOTS FOR ${selectedDates.length} DATE${selectedDates.length > 1 ? 'S' : ''}`
                                        : 'SELECT DATES FIRST'
                                    : `SLOTS: ${selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
                                }
                            </h2>
                        </div>
                        <div className="p-6">
                            {multiSelectMode && selectedDates.length === 0 ? (
                                <div className="text-center py-8 text-[var(--foreground-muted)]">
                                    <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-medium">Select dates on the calendar</p>
                                    <p className="text-xs mt-1">Then choose time slots to apply to all selected dates</p>
                                </div>
                            ) : (
                                <TimeBandSelector
                                    selectedBands={dateAvailability.map(a => a.start_time.slice(0, 5))}
                                    onToggle={toggleBand}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar with Accordion and Button */}
                <div className="space-y-6">
                    {/* Current Availability Accordion */}
                    <div className="card overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setAccordionOpen(!accordionOpen)}
                            className="w-full p-4 flex items-center justify-between bg-[var(--neutral-50)] hover:bg-[var(--neutral-100)] transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-[var(--brand-primary)]" />
                                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                                    CURRENT AVAILABILITY
                                </h2>
                                {allAvailability.length > 0 && (
                                    <span className="text-[10px] bg-[var(--brand-primary)] text-white px-2 py-0.5 rounded-full font-medium">
                                        {(() => {
                                            const uniqueDates = new Set(allAvailability.map(a => a.date))
                                            return uniqueDates.size
                                        })()}
                                    </span>
                                )}
                            </div>
                            <ChevronDown className={`w-5 h-5 text-[var(--foreground-muted)] transition-transform duration-200 ${accordionOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${accordionOpen ? 'max-h-[400px]' : 'max-h-0'}`}
                        >
                            <div className="p-4 border-t border-[var(--border-color)] overflow-y-auto max-h-[350px]">
                                {allAvailability.length === 0 ? (
                                    <div className="text-center py-6 text-[var(--foreground-muted)]">
                                        <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm font-medium">No availability set</p>
                                        <p className="text-xs mt-1">Select dates and time slots above</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {(() => {
                                            // Group by date
                                            const grouped = allAvailability.reduce((acc, slot) => {
                                                if (!acc[slot.date]) {
                                                    acc[slot.date] = []
                                                }
                                                acc[slot.date].push(slot)
                                                return acc
                                            }, {} as Record<string, RefereeDateAvailability[]>)

                                            // Sort dates and filter to only show future dates
                                            const today = new Date()
                                            today.setHours(0, 0, 0, 0)

                                            return Object.entries(grouped)
                                                .filter(([date]) => new Date(date) >= today)
                                                .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                                                .map(([date, slots]) => {
                                                    const dateObj = new Date(date)
                                                    const isToday = dateObj.toDateString() === today.toDateString()
                                                    const tomorrow = new Date(today)
                                                    tomorrow.setDate(tomorrow.getDate() + 1)
                                                    const isTomorrow = dateObj.toDateString() === tomorrow.toDateString()

                                                    return (
                                                        <div
                                                            key={date}
                                                            className="p-3 bg-[var(--neutral-50)] rounded-lg border border-[var(--border-color)]"
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-semibold text-[var(--foreground)]">
                                                                        {dateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                                    </span>
                                                                    {isToday && (
                                                                        <span className="text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                                                                            Today
                                                                        </span>
                                                                    )}
                                                                    {isTomorrow && (
                                                                        <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                                                                            Tomorrow
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-[var(--foreground-muted)]">
                                                                    {slots.length} slot{slots.length > 1 ? 's' : ''}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {slots
                                                                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                                                                    .map((slot, i) => (
                                                                        <span
                                                                            key={i}
                                                                            className="text-[10px] bg-[var(--brand-primary)] px-2 py-1 rounded font-medium"
                                                                            style={{ color: 'white' }}
                                                                        >
                                                                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                                                        </span>
                                                                    ))}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="sticky top-6 lg:static">
                        <Button
                            fullWidth
                            size="lg"
                            onClick={handleSave}
                            loading={saving}
                            disabled={
                                multiSelectMode
                                    ? selectedDates.length === 0 || (!hasChanges && centralVenueOptIn === initialOptIn && county === initialCounty)
                                    : !hasChanges && centralVenueOptIn === initialOptIn && county === initialCounty
                            }
                            className="shadow-lg"
                        >
                            {multiSelectMode && selectedDates.length > 0
                                ? `Update ${selectedDates.length} Date${selectedDates.length > 1 ? 's' : ''}`
                                : 'Update Availability'
                            }
                        </Button>
                        <p className="text-[10px] text-center mt-3 text-[var(--foreground-muted)]">
                            {multiSelectMode
                                ? '* Time slots will be applied to all selected dates'
                                : '* Changes apply only to the selected date and settings'
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
