'use client'

import { cn } from '@/lib/utils'
import { BookingStatus, OfferStatus, ComplianceStatus, UserRole } from '@/lib/types'

type StatusType = BookingStatus | OfferStatus | ComplianceStatus | UserRole | 'verified'

interface StatusChipProps {
    status: StatusType
    size?: 'sm' | 'md' | 'lg'
    glow?: boolean
    className?: string
}

const statusConfig: Record<StatusType, { label: string; colors: string }> = {
    // Booking statuses
    draft: {
        label: 'Draft',
        colors: 'bg-slate-100 text-slate-600 border-slate-200'
    },
    pending: {
        label: 'Pending',
        colors: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    offered: {
        label: 'Offered',
        colors: 'bg-violet-50 text-violet-700 border-violet-200'
    },
    confirmed: {
        label: 'Confirmed',
        colors: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    completed: {
        label: 'Completed',
        colors: 'bg-cyan-50 text-cyan-700 border-cyan-200'
    },
    cancelled: {
        label: 'Cancelled',
        colors: 'bg-red-50 text-red-600 border-red-200'
    },

    // Offer statuses
    sent: {
        label: 'Sent',
        colors: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    accepted: {
        label: 'Accepted',
        colors: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    declined: {
        label: 'Declined',
        colors: 'bg-red-50 text-red-600 border-red-200'
    },
    withdrawn: {
        label: 'Withdrawn',
        colors: 'bg-slate-100 text-slate-500 border-slate-200'
    },
    expired: {
        label: 'Expired',
        colors: 'bg-orange-50 text-orange-600 border-orange-200'
    },

    // Compliance statuses
    not_provided: {
        label: 'Not Provided',
        colors: 'bg-slate-100 text-slate-500 border-slate-200'
    },
    provided: {
        label: 'Provided',
        colors: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    verified: {
        label: 'Verified',
        colors: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },

    // User roles
    coach: {
        label: 'Coach',
        colors: 'bg-[var(--wc-coach-blue)] text-white border-transparent'
    },
    referee: {
        label: 'Referee',
        colors: 'bg-[var(--wc-ref-red)] text-white border-transparent'
    },
    admin: {
        label: 'Admin',
        colors: 'bg-gradient-to-r from-violet-500 to-purple-500 text-white border-transparent'
    },
}

const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
}

export function StatusChip({
    status,
    size = 'md',
    glow = false,
    className
}: StatusChipProps) {
    const config = statusConfig[status] || { label: status, colors: 'bg-slate-100 text-slate-600' }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 font-semibold rounded-full border uppercase tracking-wide',
                'transition-all duration-200',
                config.colors,
                sizes[size],
                glow && status === 'confirmed' && 'shadow-[0_0_12px_rgba(16,185,129,0.4)]',
                glow && status === 'pending' && 'shadow-[0_0_12px_rgba(245,158,11,0.4)]',
                className
            )}
        >
            {/* Status indicator dot for certain statuses */}
            {(status === 'pending' || status === 'offered') && (
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            )}
            {config.label}
        </span>
    )
}
