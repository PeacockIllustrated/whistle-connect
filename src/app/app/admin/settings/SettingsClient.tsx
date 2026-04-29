'use client'

import { useState, useEffect } from 'react'
import { getPlatformSettings, updatePlatformSetting } from '../actions'
import { ChevronLeft, Save, Settings } from 'lucide-react'
import Link from 'next/link'

export function SettingsClient() {
    const [travelRate, setTravelRate] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        const load = async () => {
            const result = await getPlatformSettings()
            if (result.data) {
                const pence = result.data['travel_cost_per_km_pence'] || '28'
                setTravelRate((parseInt(pence, 10) / 100).toFixed(2))
            } else if (result.error) {
                setMessage({ type: 'error', text: result.error })
            }
            setLoading(false)
        }
        load()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        setMessage(null)

        const poundsNum = parseFloat(travelRate)
        if (isNaN(poundsNum) || poundsNum < 0 || poundsNum > 2) {
            setMessage({ type: 'error', text: 'Rate must be between £0.00 and £2.00 per km' })
            setSaving(false)
            return
        }

        const pence = Math.round(poundsNum * 100).toString()
        const result = await updatePlatformSetting('travel_cost_per_km_pence', pence)

        if (result.success) {
            setMessage({ type: 'success', text: 'Travel rate updated successfully' })
        } else {
            setMessage({ type: 'error', text: result.error || 'Failed to update' })
        }
        setSaving(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <Link href="/app/admin/referees" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Platform Settings</h1>
                    <p className="text-[var(--foreground-muted)] text-sm">Configure system-wide settings</p>
                </div>
            </div>

            {message && (
                <div className={`mb-6 p-3 rounded-xl text-sm ${
                    message.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                    {message.text}
                </div>
            )}

            {/* Travel Expenses Section */}
            <div className="card p-6 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Travel Expenses</h2>
                        <p className="text-sm text-[var(--foreground-muted)]">
                            Automatically charged to coaches based on referee distance to venue
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-medium">
                        Cost per kilometre
                    </label>
                    <div className="relative max-w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] font-medium">&pound;</span>
                        <input
                            type="number"
                            value={travelRate}
                            onChange={(e) => setTravelRate(e.target.value)}
                            className="w-full pl-7 pr-16 py-3 bg-[var(--neutral-50)] border border-[var(--border-color)] rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                            step="0.01"
                            min="0"
                            max="2"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--foreground-muted)]">
                            / km
                        </span>
                    </div>
                    <p className="text-[10px] text-[var(--foreground-muted)]">
                        This rate is applied to all new offers. Existing offers keep their original rate.
                        Example: at &pound;{travelRate || '0.28'}/km, a 15 km journey costs &pound;{(parseFloat(travelRate || '0.28') * 15).toFixed(2)}.
                    </p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    )
}
