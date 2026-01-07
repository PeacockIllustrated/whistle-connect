'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AvailabilityGrid } from '@/components/app/AvailabilityGrid'
import { Button } from '@/components/ui/Button'
import { getAvailability, setAvailability } from './actions'
import { AvailabilitySlot, RefereeAvailability } from '@/lib/types'

export default function AvailabilityPage() {
    const [availability, setAvailabilityState] = useState<RefereeAvailability[]>([])
    const [pendingSlots, setPendingSlots] = useState<AvailabilitySlot[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        loadAvailability()
    }, [])

    async function loadAvailability() {
        setLoading(true)
        const result = await getAvailability()
        if (result.data) {
            setAvailabilityState(result.data)
        }
        setLoading(false)
    }

    function handleChange(slots: AvailabilitySlot[]) {
        setPendingSlots(slots)
        setHasChanges(true)
    }

    async function handleSave() {
        setSaving(true)
        setMessage(null)

        try {
            const result = await setAvailability(pendingSlots)
            if (result.error) {
                setMessage({ type: 'error', text: result.error })
            } else {
                setMessage({ type: 'success', text: 'Availability saved successfully!' })
                setHasChanges(false)
                loadAvailability()
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save availability' })
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
                    <h1 className="text-lg font-semibold">Set Availability</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Tap time slots when you're available to referee
                    </p>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-3 rounded-lg mb-4 ${message.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Grid */}
            <div className="card p-4 mb-6">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
                    </div>
                ) : (
                    <AvailabilityGrid
                        availability={availability}
                        onChange={handleChange}
                    />
                )}
            </div>

            {/* Save Button */}
            <Button
                fullWidth
                onClick={handleSave}
                loading={saving}
                disabled={!hasChanges}
            >
                {hasChanges ? 'Save Changes' : 'No Changes'}
            </Button>

            {/* Help Text */}
            <div className="mt-6 p-4 bg-[var(--neutral-50)] rounded-lg">
                <h3 className="font-semibold text-sm mb-2">How it works</h3>
                <ul className="text-sm text-[var(--foreground-muted)] space-y-1">
                    <li>• Tap on time slots to mark when you're available</li>
                    <li>• You'll receive offers for matches during your available times</li>
                    <li>• Update your availability any time</li>
                </ul>
            </div>
        </div>
    )
}
