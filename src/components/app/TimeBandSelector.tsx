'use client'

import { cn } from '@/lib/utils'

export const TIME_BANDS = [
    { start: '09:00', end: '11:00', label: '09-11' },
    { start: '11:00', end: '13:00', label: '11-13' },
    { start: '13:00', end: '15:00', label: '13-15' },
    { start: '15:00', end: '17:00', label: '15-17' },
    { start: '17:00', end: '19:00', label: '17-19' },
    { start: '19:00', end: '21:00', label: '19-21' },
]

interface TimeBandSelectorProps {
    selectedBands: string[] // e.g., ["09:00", "13:00"]
    onToggle: (startTime: string) => void
    className?: string
}

export function TimeBandSelector({ selectedBands, onToggle, className }: TimeBandSelectorProps) {
    return (
        <div className={cn("grid grid-cols-2 gap-3", className)}>
            {TIME_BANDS.map((band) => {
                const isSelected = selectedBands.includes(band.start)
                return (
                    <button
                        key={band.start}
                        onClick={() => onToggle(band.start)}
                        className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
                            isSelected
                                ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-md scale-[1.02]"
                                : "bg-white border-[var(--border-color)] text-[var(--foreground)] hover:border-[var(--color-primary)]/50"
                        )}
                    >
                        <span className="text-lg font-bold">{band.label}</span>
                        <span className="text-[10px] opacity-70">AVAILABLE</span>
                    </button>
                )
            })}
        </div>
    )
}
