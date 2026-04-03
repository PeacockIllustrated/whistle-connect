'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fireTestNotification } from '@/app/app/profile/actions'
import { useToast } from '@/components/ui/Toast'
import { Bell, Play, Square, FlaskConical } from 'lucide-react'

const SCENARIO_LABELS = [
    { title: 'SOS — Referee Needed!', type: 'warning' },
    { title: 'New Booking Request', type: 'info' },
    { title: 'Offer Priced!', type: 'info' },
    { title: 'Booking Confirmed!', type: 'success' },
    { title: 'Referee Pulled Out', type: 'warning' },
    { title: 'Match Completed', type: 'success' },
    { title: 'Offer Declined', type: 'info' },
]

const TYPE_COLORS: Record<string, string> = {
    info: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
}

export function NotificationTester() {
    const [active, setActive] = useState(false)
    const [scenarioIndex, setScenarioIndex] = useState(0)
    const [countdown, setCountdown] = useState(60)
    const [sending, setSending] = useState(false)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const { showToast } = useToast()

    const fire = useCallback(async (index: number) => {
        setSending(true)
        const result = await fireTestNotification(index)
        setSending(false)

        if (result.error) {
            showToast({ message: `Test failed: ${result.error}`, type: 'error' })
        } else {
            showToast({ message: `Sent: ${result.scenario}`, type: 'success' })
        }

        setScenarioIndex((index + 1) % SCENARIO_LABELS.length)
        setCountdown(60)
    }, [showToast])

    useEffect(() => {
        if (active) {
            // Fire immediately on start
            fire(scenarioIndex)

            // Then every 60 seconds
            intervalRef.current = setInterval(() => {
                setScenarioIndex(prev => {
                    const next = (prev + 1) % SCENARIO_LABELS.length
                    fire(next)
                    return next
                })
            }, 60000)

            // Countdown ticker
            countdownRef.current = setInterval(() => {
                setCountdown(prev => (prev <= 1 ? 60 : prev - 1))
            }, 1000)
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active])

    const handleToggle = () => {
        if (active) {
            setActive(false)
            setCountdown(60)
        } else {
            setActive(true)
        }
    }

    const nextScenario = SCENARIO_LABELS[scenarioIndex]

    return (
        <div className="card p-4 mb-4 border border-dashed border-[var(--border-color)]">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <FlaskConical className="w-4 h-4 text-violet-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-violet-500">
                    Test Feature
                </span>
            </div>

            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="font-semibold text-sm">Notification Simulator</h3>
                    <p className="text-xs text-[var(--foreground-muted)]">
                        Fires a test notification every 60s (in-app + push)
                    </p>
                </div>
                <button
                    onClick={handleToggle}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        active
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                    }`}
                >
                    {active ? (
                        <><Square className="w-3 h-3" /> Stop</>
                    ) : (
                        <><Play className="w-3 h-3" /> Start</>
                    )}
                </button>
            </div>

            {/* Active state */}
            {active && (
                <div className="space-y-2">
                    {/* Countdown */}
                    <div className="flex items-center gap-2 text-xs text-[var(--foreground-muted)]">
                        <Bell className={`w-3.5 h-3.5 ${sending ? 'animate-bounce text-violet-500' : ''}`} />
                        <span>Next in <strong className="text-[var(--foreground)]">{countdown}s</strong></span>
                    </div>

                    {/* Next scenario preview */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--neutral-50)] border border-[var(--border-color)]">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_COLORS[nextScenario.type]}`} />
                        <span className="text-xs font-medium truncate">
                            Up next: {nextScenario.title}
                        </span>
                    </div>

                    {/* Scenario list */}
                    <div className="grid grid-cols-1 gap-1 pt-1">
                        {SCENARIO_LABELS.map((s, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${
                                    i === scenarioIndex
                                        ? 'bg-violet-50 text-violet-700 font-semibold'
                                        : 'text-[var(--foreground-muted)]'
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_COLORS[s.type]}`} />
                                {s.title}
                                {i === scenarioIndex && (
                                    <span className="ml-auto text-[10px] text-violet-400">next</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
