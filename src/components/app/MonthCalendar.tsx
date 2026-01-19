'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface MonthCalendarProps {
    selectedDate: Date
    onDateSelect: (date: Date) => void
    className?: string
}

export function MonthCalendar({ selectedDate, onDateSelect, className }: MonthCalendarProps) {
    const [viewDate, setViewDate] = useState(new Date(selectedDate))

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay()

    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    const totalDays = daysInMonth(year, month)
    const firstDay = firstDayOfMonth(year, month)

    const prevMonthDays = daysInMonth(year, month - 1)
    const calendarDays = []

    // Pad with previous month's days
    for (let i = firstDay - 1; i >= 0; i--) {
        calendarDays.push({
            day: prevMonthDays - i,
            month: month - 1,
            year,
            isCurrentMonth: false
        })
    }

    // Current month's days
    for (let i = 1; i <= totalDays; i++) {
        calendarDays.push({
            day: i,
            month,
            year,
            isCurrentMonth: true
        })
    }

    // Pad with next month's days
    const remainingSlots = 42 - calendarDays.length
    for (let i = 1; i <= remainingSlots; i++) {
        calendarDays.push({
            day: i,
            month: month + 1,
            year,
            isCurrentMonth: false
        })
    }

    const nextMonth = () => setViewDate(new Date(year, month + 1, 1))
    const prevMonth = () => setViewDate(new Date(year, month - 1, 1))

    const monthName = viewDate.toLocaleString('default', { month: 'long' })

    const isSelected = (day: number, m: number, y: number) => {
        return selectedDate.getDate() === day &&
            selectedDate.getMonth() === m &&
            selectedDate.getFullYear() === y
    }

    return (
        <div className={cn("select-none", className)}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">
                    {monthName} {year}
                </h3>
                <div className="flex gap-1">
                    <button
                        onClick={prevMonth}
                        className="p-1 hover:bg-[var(--neutral-100)] rounded-md transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-1 hover:bg-[var(--neutral-100)] rounded-md transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className="text-[10px] font-bold text-[var(--foreground-muted)] text-center py-1">
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((dateObj, i) => {
                    const active = isSelected(dateObj.day, dateObj.month, dateObj.year)
                    return (
                        <button
                            key={i}
                            onClick={() => onDateSelect(new Date(dateObj.year, dateObj.month, dateObj.day))}
                            className={cn(
                                "aspect-square flex items-center justify-center text-sm rounded-lg transition-all",
                                dateObj.isCurrentMonth ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)] opacity-30",
                                active ? "bg-[var(--color-primary)] text-white font-bold scale-105 shadow-sm" : "hover:bg-[var(--neutral-100)]"
                            )}
                        >
                            {dateObj.day}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
