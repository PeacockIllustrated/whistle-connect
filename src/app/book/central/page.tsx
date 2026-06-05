'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Banknote } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { UK_COUNTIES } from '@/lib/constants'
import { toLocalDateString } from '@/lib/utils'
import { createBooking } from '@/app/app/bookings/actions'
import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay'
import { VenueMap } from '@/components/ui/VenueMap'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'

export default function CentralBookingPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    // ?type=tournament repurposes this same form for the third booking type.
    // Tournament reuses the central-venue UX but tags the booking row with
    // booking_type='tournament' so downstream surfaces can render it as a
    // tournament rather than a generic central venue.
    const isTournament = searchParams.get('type') === 'tournament'
    const bookingType: 'central' | 'tournament' = isTournament ? 'tournament' : 'central'
    const headingPageTitle = isTournament ? 'Tournament Booking' : 'Central Venue Booking'
    const headingFormTitle = isTournament ? 'Tournament Details' : 'Event Details'
    const headingFormSubtitle = isTournament
        ? 'Enter the details for your tournament day to find available referees.'
        : 'Enter the details for your central venue event to find available referees.'

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [celebration, setCelebration] = useState<{ bookingId: string } | null>(null)
    const [tournamentName, setTournamentName] = useState('')
    const [formData, setFormData] = useState({
        county: '',
        match_date: '',
        location_postcode: '',
        address_text: '',
        notes: '',
        budget_pounds: '' as string,
    })

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    // Multi-game schedule — one booking, many games. Each row is a kick-off
    // time + optional team names; there's no per-game date (the booking-level
    // event date applies to all). Mirrors the in-app /app/bookings/new builder
    // so a tournament/central booked from the landing page captures the full
    // fixture list — createBooking REQUIRES at least one match for these types,
    // so without this the landing-page booking silently failed.
    type MatchRow = { kickoff_time: string; home_team: string; away_team: string }
    const [matches, setMatches] = useState<MatchRow[]>([
        { kickoff_time: '', home_team: '', away_team: '' },
    ])
    const addMatch = () => setMatches([...matches, { kickoff_time: '', home_team: '', away_team: '' }])
    const removeMatch = (i: number) => setMatches(matches.filter((_, idx) => idx !== i))
    const updateMatch = (i: number, patch: Partial<MatchRow>) =>
        setMatches(matches.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))

    // Debounced postcode for map preview
    const debouncedPostcode = useDebouncedValue(formData.location_postcode, 500)

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

        // Match fee is collected up front so refs see it on the feed and the
        // coach has it pre-set when sending offers — fixes the missing-price
        // gap reported by Davey.
        const budget = formData.budget_pounds.trim()
            ? parseInt(formData.budget_pounds.trim(), 10)
            : undefined

        // One booking, many games. Drop empty rows, then the booking-level
        // kickoff_time is the EARLIEST game (keeps the feed / notifications /
        // find_bookings_near_referee working); the rest travels in `matches`.
        const cleanMatches = matches
            .filter(m => m.kickoff_time)
            .map(m => ({
                kickoff_time: m.kickoff_time,
                home_team: m.home_team.trim() || undefined,
                away_team: m.away_team.trim() || undefined,
            }))

        if (cleanMatches.length === 0) {
            setError('Add at least one game with a kick-off time')
            setIsSubmitting(false)
            return
        }

        const earliestKickoff = cleanMatches.map(m => m.kickoff_time).sort()[0]

        try {
            const result = await createBooking({
                match_date: formData.match_date,
                kickoff_time: earliestKickoff,
                location_postcode: formData.location_postcode,
                county: formData.county,
                ground_name: formData.address_text,
                address_text: formData.address_text,
                notes: formData.notes,
                budget_pounds: budget,
                booking_type: bookingType,
                tournament_name: isTournament ? tournamentName.trim() : undefined,
                matches: cleanMatches,
            })
            if (result?.error) {
                setError(result.error)
                setIsSubmitting(false)
            } else if (result?.success && result?.bookingId) {
                setCelebration({ bookingId: result.bookingId })
            }
        } catch {
            setError('Failed to create booking')
            setIsSubmitting(false)
        }
    }

    if (celebration) {
        return (
            <CelebrationOverlay
                icon="check-circle"
                title="Booking Created!"
                subtitle="Let's find a referee"
                onComplete={() => router.push(`/app/bookings/${celebration.bookingId}/match`)}
            />
        )
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
            <header className="bg-[var(--neutral-900)] text-white py-4 px-4">
                <div className="max-w-[var(--content-max-width)] mx-auto flex items-center gap-3">
                    <Link href="/book" className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-lg font-semibold tracking-tight">{headingPageTitle}</h1>
                </div>
            </header>

            <main className="flex-1 max-w-[var(--content-max-width)] mx-auto w-full px-4 py-8">
                <div className="bg-white rounded-2xl border border-[var(--border-color)] p-6 shadow-sm">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-2">{headingFormTitle}</h2>
                        <p className="text-[var(--foreground-muted)] text-sm">
                            {headingFormSubtitle}
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

                            {isTournament && (
                                <Input
                                    label="Tournament Name"
                                    value={tournamentName}
                                    onChange={(e) => setTournamentName(e.target.value)}
                                    placeholder="e.g. Summer Cup 2026"
                                    required
                                />
                            )}

                            <Input
                                label={isTournament ? 'Tournament Date' : 'Event Date'}
                                type="date"
                                value={formData.match_date}
                                onChange={(e) => updateField('match_date', e.target.value)}
                                min={toLocalDateString(new Date())}
                                hint="One date for the whole event — add each game's kick-off time below."
                                required
                            />

                            {/* Multi-game schedule — one booking, many games. Each
                                game has its own kick-off time and optional teams. */}
                            <div className="space-y-3">
                                <p className="text-sm font-medium text-[var(--foreground)]">Games</p>
                                {matches.map((m, i) => (
                                    <div key={i} className="rounded-xl border border-[var(--border-color)] p-3 space-y-3 bg-[var(--neutral-50)]">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-[var(--neutral-400)] uppercase">Game {i + 1}</span>
                                            {matches.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeMatch(i)}
                                                    className="text-xs font-semibold text-red-600 hover:underline"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        <Input
                                            label="Kick-off time"
                                            type="time"
                                            value={m.kickoff_time}
                                            onChange={(e) => updateMatch(i, { kickoff_time: e.target.value })}
                                            required
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="Home Team"
                                                value={m.home_team}
                                                onChange={(e) => updateMatch(i, { home_team: e.target.value })}
                                                placeholder="Optional"
                                            />
                                            <Input
                                                label="Away Team"
                                                value={m.away_team}
                                                onChange={(e) => updateMatch(i, { away_team: e.target.value })}
                                                placeholder="Optional"
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addMatch}
                                    className="w-full rounded-xl border-2 border-dashed border-[var(--border-color)] py-3 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--neutral-50)] transition-colors"
                                >
                                    + Add another game
                                </button>
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

                            {debouncedPostcode.length >= 5 && (
                                <VenueMap postcode={debouncedPostcode} height={160} />
                            )}

                            {/* Match fee — required so coaches can't accidentally
                                ship a £0 listing onto the ref feed. Same shape
                                as the post-login form's price field. This is ONE
                                fee for the whole booking (all games), since a
                                central/tournament booking is a single unit — the
                                copy spells that out so coaches don't read it as
                                per-game. */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5 flex items-center gap-1.5">
                                    <Banknote className="w-4 h-4 text-emerald-600" />
                                    Total referee fee (all games)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] font-medium">&pound;</span>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="0"
                                        value={formData.budget_pounds}
                                        onChange={(e) => updateField('budget_pounds', e.target.value)}
                                        className="w-full pl-7 pr-3 py-2.5 min-h-[44px] text-base bg-white border border-[var(--border-color)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent transition-colors"
                                        min="1"
                                        max="500"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-[var(--foreground-muted)] mt-1.5">
                                    The total you&apos;ll pay the referee for {isTournament ? 'the whole tournament day' : 'the whole session'} — one fee for every game that day, not a price per game. Travel costs and the booking fee are added on top when you send an offer.
                                </p>
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
