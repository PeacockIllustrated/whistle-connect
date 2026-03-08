'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSOSBooking } from './actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay'
import { ChevronLeft, Siren, MapPin, Clock, Users, Banknote } from 'lucide-react'

const AGE_GROUPS = [
    'Under 7', 'Under 8', 'Under 9', 'Under 10', 'Under 11', 'Under 12',
    'Under 13', 'Under 14', 'Under 15', 'Under 16', 'Under 18', 'Adult',
]

const FORMATS = [
    { value: '5v5', label: '5v5' },
    { value: '7v7', label: '7v7' },
    { value: '9v9', label: '9v9' },
    { value: '11v11', label: '11v11' },
]

export default function SOSPage() {
    const router = useRouter()
    const { showToast } = useToast()
    const [isPending, startTransition] = useTransition()
    const [celebration, setCelebration] = useState(false)

    const [postcode, setPostcode] = useState('')
    const [kickoff, setKickoff] = useState('')
    const [ageGroup, setAgeGroup] = useState('')
    const [format, setFormat] = useState('')
    const [fee, setFee] = useState('')
    const [groundName, setGroundName] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!postcode.trim() || !kickoff) {
            showToast({ message: 'Postcode and kickoff time are required', type: 'error' })
            return
        }

        startTransition(async () => {
            const result = await createSOSBooking({
                location_postcode: postcode.trim().toUpperCase(),
                kickoff_time: kickoff,
                age_group: ageGroup || undefined,
                format: format || undefined,
                budget_pounds: fee ? parseInt(fee) : undefined,
                ground_name: groundName || undefined,
            })

            if (result.error) {
                showToast({ message: result.error, type: 'error' })
            } else {
                setCelebration(true)
                setTimeout(() => {
                    router.push(`/app/bookings/${result.bookingId}`)
                }, 2000)
            }
        })
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto pb-24">
            {celebration && (
                <CelebrationOverlay
                    icon="send"
                    title="SOS Broadcast Sent!"
                    subtitle="Nearby referees are being notified"
                    onComplete={() => setCelebration(false)}
                />
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                        <Siren className="w-5 h-5" />
                        Referee SOS
                    </h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Emergency broadcast to nearby referees
                    </p>
                </div>
            </div>

            {/* Urgency notice */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-red-700 font-medium">
                    This sends an urgent notification to all available referees near your location. The first referee to accept will be automatically assigned.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="card p-4 space-y-4">
                    {/* Postcode */}
                    <div>
                        <label className="text-xs font-bold text-[var(--foreground-muted)] uppercase mb-2 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" />
                            Match Postcode *
                        </label>
                        <Input
                            value={postcode}
                            onChange={(e) => setPostcode(e.target.value)}
                            placeholder="e.g. SW1A 1AA"
                            required
                        />
                    </div>

                    {/* Kickoff time */}
                    <div>
                        <label className="text-xs font-bold text-[var(--foreground-muted)] uppercase mb-2 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Kickoff Time *
                        </label>
                        <Input
                            type="time"
                            value={kickoff}
                            onChange={(e) => setKickoff(e.target.value)}
                            required
                        />
                    </div>

                    {/* Ground name */}
                    <div>
                        <label className="text-xs font-bold text-[var(--foreground-muted)] uppercase mb-2 block">
                            Ground Name
                        </label>
                        <Input
                            value={groundName}
                            onChange={(e) => setGroundName(e.target.value)}
                            placeholder="e.g. Victoria Park Pitch 3"
                        />
                    </div>
                </div>

                <div className="card p-4 space-y-4">
                    {/* Age group */}
                    <div>
                        <label className="text-xs font-bold text-[var(--foreground-muted)] uppercase mb-2 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            Age Group
                        </label>
                        <Select
                            options={AGE_GROUPS.map(ag => ({ value: ag, label: ag }))}
                            value={ageGroup}
                            onChange={(e) => setAgeGroup(e.target.value)}
                            placeholder="Select age group"
                        />
                    </div>

                    {/* Format */}
                    <div>
                        <label className="text-xs font-bold text-[var(--foreground-muted)] uppercase mb-2 block">
                            Format
                        </label>
                        <Select
                            options={FORMATS}
                            value={format}
                            onChange={(e) => setFormat(e.target.value)}
                            placeholder="Select format"
                        />
                    </div>

                    {/* Fee */}
                    <div>
                        <label className="text-xs font-bold text-[var(--foreground-muted)] uppercase mb-2 flex items-center gap-1.5">
                            <Banknote className="w-3.5 h-3.5" />
                            Match Fee (&pound;)
                        </label>
                        <Input
                            type="number"
                            value={fee}
                            onChange={(e) => setFee(e.target.value)}
                            placeholder="e.g. 40"
                            min={0}
                        />
                    </div>
                </div>

                {/* Submit */}
                <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    variant="danger"
                    loading={isPending}
                    className="shadow-lg"
                >
                    <Siren className="w-5 h-5 mr-2" />
                    BROADCAST SOS
                </Button>

                <p className="text-[10px] text-center text-[var(--foreground-muted)]">
                    * Nearby available referees within 30km will be notified immediately
                </p>
            </form>
        </div>
    )
}
