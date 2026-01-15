'use client'

import { cn, getDayName } from '@/lib/utils'
import { RefereeAvailability, AvailabilitySlot } from '@/lib/types'
import { useState } from 'react'

const TIME_SLOTS = [
    { start: '09:00', end: '11:00', label: '09:00-11:00' },
    { start: '11:00', end: '13:00', label: '11:00-13:00' },
    { start: '13:00', end: '15:00', label: '13:00-15:00' },
    { start: '15:00', end: '17:00', label: '15:00-17:00' },
    { start: '17:00', end: '19:00', label: '17:00-19:00' },
    { start: '19:00', end: '21:00', label: '19:00-21:00' },
]

const DAYS = [0, 1, 2, 3, 4, 5, 6] // Sunday to Saturday

export interface AvailabilityGridProps {
    availability?: RefereeAvailability[]
    onChange?: (slots: AvailabilitySlot[]) => void
    readonly?: boolean
    className?: string
}

export function AvailabilityGrid({
    availability = [],
    onChange,
    readonly = false,
    className
}: AvailabilityGridProps) {
    // Get current week dates
    const getWeekDates = () => {
        const now = new Date()
        const day = now.getDay() // 0-6
        const sunday = new Date(now)
        sunday.setDate(now.getDate() - day)

        return DAYS.map(d => {
            const date = new Date(sunday)
            date.setDate(sunday.getDate() + d)
            return date
        })
    }

    const weekDates = getWeekDates()

    // Convert availability to a map for quick lookups
    const getSlotKey = (day: number, start: string) => `${day}-${start}`

    const [selectedSlots, setSelectedSlots] = useState<Set<string>>(() => {
        const slots = new Set<string>()
        availability.forEach(slot => {
            // Find matching time slot
            // Check for exact start/end match or if it fits within the new bands
            const timeSlot = TIME_SLOTS.find(
                ts => slot.start_time.startsWith(ts.start) && slot.end_time.startsWith(ts.end)
            )
            if (timeSlot) {
                slots.add(getSlotKey(slot.day_of_week, timeSlot.start))
            }
        })
        return slots
    })

    const toggleSlot = (day: number, timeSlot: typeof TIME_SLOTS[0]) => {
        if (readonly) return

        const key = getSlotKey(day, timeSlot.start)
        const newSlots = new Set(selectedSlots)

        if (newSlots.has(key)) {
            newSlots.delete(key)
        } else {
            newSlots.add(key)
        }

        setSelectedSlots(newSlots)

        // Convert back to AvailabilitySlot array
        if (onChange) {
            const slots: AvailabilitySlot[] = Array.from(newSlots).map(key => {
                const [day, start] = key.split('-')
                const timeSlot = TIME_SLOTS.find(ts => ts.start === start)!
                return {
                    day_of_week: parseInt(day),
                    start_time: timeSlot.start + ':00',
                    end_time: timeSlot.end + ':00',
                }
            })
            onChange(slots)
        }
    }

    return (
        <div className={cn('overflow-x-auto', className)}>
            <div className="min-w-[700px]">
                {/* Header Row - Time slots */}
                <div className="grid grid-cols-[100px_repeat(6,1fr)] gap-1 mb-2">
                    <div className="text-xs font-medium text-[var(--foreground-muted)] p-2" />
                    {TIME_SLOTS.map(slot => (
                        <div
                            key={slot.start}
                            className="text-[10px] font-medium text-[var(--foreground-muted)] text-center p-2 leading-tight"
                        >
                            {slot.label}
                        </div>
                    ))}
                </div>

                {/* Day Rows */}
                {DAYS.map(day => {
                    const date = weekDates[day]
                    const isToday = new Date().toDateString() === date.toDateString()

                    return (
                        <div key={day} className="grid grid-cols-[100px_repeat(6,1fr)] gap-1 mb-1">
                            <div className={cn(
                                "p-2 flex flex-col justify-center",
                                isToday && "bg-[var(--color-primary)]/5 rounded-lg"
                            )}>
                                <span className="text-sm font-semibold text-[var(--foreground)]">
                                    {getDayName(day).slice(0, 3)}
                                </span>
                                <span className="text-[10px] text-[var(--foreground-muted)]">
                                    {date.getDate()} {date.toLocaleString('default', { month: 'short' })}
                                </span>
                            </div>
                            {TIME_SLOTS.map(slot => {
                                const key = getSlotKey(day, slot.start)
                                const isSelected = selectedSlots.has(key)

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => toggleSlot(day, slot)}
                                        disabled={readonly}
                                        className={cn(
                                            'h-12 rounded-lg border-2 transition-all duration-200',
                                            'touch-target',
                                            isSelected
                                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                                                : 'bg-white border-[var(--border-color)] hover:border-[var(--color-primary)]/50',
                                            readonly && 'cursor-default',
                                            !readonly && !isSelected && 'hover:bg-[var(--neutral-50)]'
                                        )}
                                    >
                                        {isSelected && (
                                            <svg className="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-xs text-[var(--foreground-muted)]">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[var(--color-primary)]" />
                    <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-[var(--border-color)]" />
                    <span>Not set</span>
                </div>
            </div>
        </div>
    )
}
