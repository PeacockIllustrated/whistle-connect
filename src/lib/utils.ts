import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    })
}

export function formatTime(timeString: string): string {
    // Handle HH:MM:SS format
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'pm' : 'am'
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes}${ampm}`
}

export function getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[dayOfWeek]
}

export function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
        draft: 'chip-draft',
        pending: 'chip-pending',
        offered: 'chip-offered',
        confirmed: 'chip-confirmed',
        completed: 'chip-completed',
        cancelled: 'chip-cancelled',
    }
    return colors[status] || 'chip-draft'
}

export function truncate(str: string, length: number): string {
    if (str.length <= length) return str
    return str.slice(0, length) + '...'
}

export function getInitials(name: string): string {
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
}

// Faint background tint + left border accent for status-at-a-glance on cards
const statusCardStyles: Record<string, string> = {
    draft: '!bg-slate-50/60 border-l-4 border-l-slate-300',
    pending: '!bg-amber-50/50 border-l-4 border-l-amber-400',
    offered: '!bg-violet-50/50 border-l-4 border-l-violet-400',
    confirmed: '!bg-emerald-50/50 border-l-4 border-l-emerald-500',
    completed: '!bg-cyan-50/40 border-l-4 border-l-cyan-400',
    cancelled: '!bg-red-50/50 border-l-4 border-l-red-400',
    sent: '!bg-blue-50/50 border-l-4 border-l-blue-400',
    accepted: '!bg-emerald-50/50 border-l-4 border-l-emerald-500',
    declined: '!bg-red-50/50 border-l-4 border-l-red-400',
    withdrawn: '!bg-slate-50/60 border-l-4 border-l-slate-300',
    accepted_priced: '!bg-indigo-50/50 border-l-4 border-l-indigo-400',
    expired: '!bg-orange-50/50 border-l-4 border-l-orange-400',
}

export function getStatusCardStyle(status: string): string {
    return statusCardStyles[status] || ''
}

/** Validates an FA number: must be 8-10 digits */
export function isValidFANumber(fan: string): boolean {
    return /^\d{8,10}$/.test(fan)
}
