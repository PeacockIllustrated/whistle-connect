'use client'

import { useState, useTransition } from 'react'
import { toggleAvailability, updateTravelRadius } from '@/app/app/availability/actions'
import { useToast } from '@/components/ui/Toast'
import { MapPin, Zap, ZapOff } from 'lucide-react'

interface AvailabilityToggleProps {
    initialAvailable: boolean
    initialRadius: number
}

export function AvailabilityToggle({ initialAvailable, initialRadius }: AvailabilityToggleProps) {
    const [isAvailable, setIsAvailable] = useState(initialAvailable)
    const [radius, setRadius] = useState(initialRadius)
    const [isPending, startTransition] = useTransition()
    const { showToast } = useToast()

    const handleToggle = () => {
        const newValue = !isAvailable
        setIsAvailable(newValue)
        startTransition(async () => {
            const result = await toggleAvailability(newValue)
            if (result.error) {
                setIsAvailable(!newValue) // revert
                showToast({ message: result.error, type: 'error' })
            }
        })
    }

    const handleRadiusChange = (newRadius: number) => {
        setRadius(newRadius)
        startTransition(async () => {
            const result = await updateTravelRadius(newRadius)
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
            }
        })
    }

    return (
        <div className="card p-4 space-y-4">
            {/* Availability Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        isAvailable
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-[var(--neutral-100)] text-[var(--foreground-muted)]'
                    }`}>
                        {isAvailable ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
                    </div>
                    <div>
                        <p className="font-semibold text-sm">
                            {isAvailable ? 'Available for matches' : 'Not available'}
                        </p>
                        <p className="text-xs text-[var(--foreground-muted)]">
                            {isAvailable ? 'Coaches can find you nearby' : 'You won\'t appear in searches'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleToggle}
                    disabled={isPending}
                    className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                        isAvailable ? 'bg-emerald-500' : 'bg-[var(--neutral-300)]'
                    }`}
                    aria-label={isAvailable ? 'Disable availability' : 'Enable availability'}
                >
                    <span
                        className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                            isAvailable ? 'translate-x-6' : 'translate-x-0'
                        }`}
                    />
                </button>
            </div>

            {/* Travel Radius */}
            <div className="pt-2 border-t border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[var(--foreground-muted)]" />
                        <span className="text-sm font-medium">Travel radius</span>
                    </div>
                    <span className="text-sm font-bold text-[var(--brand-primary)]">{radius} km</span>
                </div>
                <input
                    type="range"
                    min={1}
                    max={50}
                    value={radius}
                    onChange={(e) => handleRadiusChange(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[var(--brand-primary)]"
                    style={{
                        background: `linear-gradient(to right, var(--brand-primary) 0%, var(--brand-primary) ${((radius - 1) / 49) * 100}%, var(--neutral-200) ${((radius - 1) / 49) * 100}%, var(--neutral-200) 100%)`,
                    }}
                />
                <div className="flex justify-between text-[10px] text-[var(--foreground-muted)] mt-1">
                    <span>1 km</span>
                    <span>25 km</span>
                    <span>50 km</span>
                </div>
            </div>
        </div>
    )
}
