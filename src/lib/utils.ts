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

export function getComplianceColor(status: string): string {
    const colors: Record<string, string> = {
        not_provided: 'text-gray-500 bg-gray-100',
        provided: 'text-blue-700 bg-blue-100',
        verified: 'text-green-700 bg-green-100',
        expired: 'text-red-700 bg-red-100',
    }
    return colors[status] || 'text-gray-500 bg-gray-100'
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
