'use client'

import { useState, useTransition, useRef, useCallback, useEffect } from 'react'
import { toggleAvailability, updateTravelRadius } from '@/app/app/availability/actions'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/Modal'
import { MapPin, Zap, ZapOff } from 'lucide-react'

interface AvailabilityToggleProps {
    initialAvailable: boolean
    initialRadius: number
}

export function AvailabilityToggle({ initialAvailable, initialRadius }: AvailabilityToggleProps) {
    const [isAvailable, setIsAvailable] = useState(initialAvailable)
    const [radius, setRadius] = useState(initialRadius)
    const [togglePending, startToggleTransition] = useTransition()
    const [radiusPending, startRadiusTransition] = useTransition()
    const [confirmOff, setConfirmOff] = useState(false)
    const { showToast } = useToast()
    const radiusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Sync internal state when the parent finishes its async DB load and
    // passes new initial values. Without this, useState locks onto the
    // first-render prop (false) and the toggle permanently shows "off"
    // even after the DB returns true on page refresh.
    useEffect(() => { setIsAvailable(initialAvailable) }, [initialAvailable])
    useEffect(() => { setRadius(initialRadius) }, [initialRadius])

    const applyToggle = (newValue: boolean) => {
        setIsAvailable(newValue)
        startToggleTransition(async () => {
            const result = await toggleAvailability(newValue)
            if (result.error) {
                setIsAvailable(!newValue) // revert
                showToast({ message: result.error, type: 'error' })
            } else {
                showToast({ message: newValue ? 'You are now available' : 'You are now unavailable', type: 'success' })
            }
        })
    }

    const handleToggle = () => {
        if (isAvailable) {
            // Turning OFF — confirm first so it can't happen by accident.
            setConfirmOff(true)
        } else {
            applyToggle(true)
        }
    }

    // Debounce radius saves — update UI instantly, save after user stops dragging
    const saveRadius = useCallback((value: number) => {
        if (radiusTimerRef.current) clearTimeout(radiusTimerRef.current)
        radiusTimerRef.current = setTimeout(() => {
            startRadiusTransition(async () => {
                const result = await updateTravelRadius(value)
                if (result.error) {
                    showToast({ message: result.error, type: 'error' })
                }
            })
        }, 400)
    }, [showToast])

    const handleRadiusChange = (newRadius: number) => {
        setRadius(newRadius)
        saveRadius(newRadius)
    }

    return (
        <div
            className={`card p-4 space-y-4 transition-colors ${
                isAvailable ? '' : 'border-red-300 bg-red-50'
            }`}
        >
            {/* Availability Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        isAvailable
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-red-100 text-red-600'
                    }`}>
                        {isAvailable ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
                    </div>
                    <div>
                        <p className={`font-semibold text-sm ${isAvailable ? '' : 'text-red-700'}`}>
                            {isAvailable ? 'Available for matches' : 'Not available'}
                        </p>
                        <p className={`text-xs ${isAvailable ? 'text-[var(--foreground-muted)]' : 'text-red-700/80'}`}>
                            {isAvailable ? 'Coaches can find you nearby' : "You won't appear in any coach searches"}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleToggle}
                    disabled={togglePending}
                    className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                        isAvailable ? 'bg-emerald-500' : 'bg-red-500'
                    } ${togglePending ? 'opacity-60' : ''}`}
                    aria-label={isAvailable ? 'Disable availability' : 'Enable availability'}
                >
                    <span
                        className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                            isAvailable ? 'translate-x-6' : 'translate-x-0'
                        }`}
                    />
                </button>
            </div>

            <ConfirmDialog
                isOpen={confirmOff}
                onClose={() => setConfirmOff(false)}
                onConfirm={() => applyToggle(false)}
                title="Mark yourself unavailable?"
                message="Coaches won't be able to find you in searches or send you offers until you turn this back on."
                confirmLabel="Yes, go unavailable"
                cancelLabel="Cancel"
                variant="danger"
            />

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
