import { CheckCircle, Clock, XCircle } from 'lucide-react'
import type { FAVerificationStatus } from '@/lib/types'

const statusConfig: Record<FAVerificationStatus, {
    label: string
    colors: string
    icon: typeof CheckCircle | null
}> = {
    not_provided: {
        label: 'Not Provided',
        colors: 'text-slate-500 bg-slate-50 border-slate-200',
        icon: null,
    },
    pending: {
        label: 'Pending',
        colors: 'text-amber-700 bg-amber-50 border-amber-200',
        icon: Clock,
    },
    verified: {
        label: 'FA Verified',
        colors: 'text-green-700 bg-green-50 border-green-200',
        icon: CheckCircle,
    },
    rejected: {
        label: 'Rejected',
        colors: 'text-red-600 bg-red-50 border-red-200',
        icon: XCircle,
    },
}

export function FAStatusBadge({ status }: { status: FAVerificationStatus }) {
    const config = statusConfig[status]
    const Icon = config.icon
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${config.colors}`}>
            {Icon && <Icon className="w-3 h-3" />}
            {config.label}
        </span>
    )
}
