'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
    updateNotificationPreference,
    CATEGORY_LABELS,
    type NotificationPreference,
} from '@/app/app/notifications/actions'
import type { NotificationCategory } from '@/lib/notifications'
import {
    Bell,
    BellOff,
    Smartphone,
    Monitor,
    CalendarDays,
    MessageSquare,
    ShieldCheck,
    Star,
    Megaphone,
    MapPin,
    AlertTriangle,
    Handshake,
    ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'

interface NotificationSettingsProps {
    initialPreferences: NotificationPreference[]
}

const CATEGORY_ICONS: Record<string, typeof Bell> = {
    booking_update: CalendarDays,
    offer_update: Handshake,
    match_reminder: Bell,
    new_match_nearby: MapPin,
    sos_alert: AlertTriangle,
    message: MessageSquare,
    verification: ShieldCheck,
    rating: Star,
    system: Megaphone,
}

export function NotificationSettings({ initialPreferences }: NotificationSettingsProps) {
    const [preferences, setPreferences] = useState<NotificationPreference[]>(initialPreferences)
    const [saving, setSaving] = useState<string | null>(null)

    const handleToggle = async (
        category: NotificationCategory,
        field: 'in_app' | 'push',
    ) => {
        const pref = preferences.find(p => p.category === category)
        if (!pref) return

        const newValue = !pref[field]

        // Optimistic update
        setPreferences(prev =>
            prev.map(p =>
                p.category === category ? { ...p, [field]: newValue } : p
            )
        )

        setSaving(category)
        const result = await updateNotificationPreference(category, {
            in_app: field === 'in_app' ? newValue : pref.in_app,
            push: field === 'push' ? newValue : pref.push,
        })

        if (result.error) {
            // Revert on error
            setPreferences(prev =>
                prev.map(p =>
                    p.category === category ? { ...p, [field]: !newValue } : p
                )
            )
        }
        setSaving(null)
    }

    return (
        <div>
            <Link
                href="/app/notifications"
                className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] font-medium mb-6 hover:underline"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to notifications
            </Link>

            <div className="card overflow-hidden">
                {/* Header */}
                <div className="p-4 bg-[var(--neutral-50)] border-b border-[var(--border-color)]">
                    <div className="grid grid-cols-[1fr_80px_80px] gap-4 items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                            Category
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)] text-center flex items-center justify-center gap-1">
                            <Monitor className="w-3.5 h-3.5" />
                            In-App
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)] text-center flex items-center justify-center gap-1">
                            <Smartphone className="w-3.5 h-3.5" />
                            Push
                        </span>
                    </div>
                </div>

                {/* Preference Rows */}
                <div className="divide-y divide-[var(--border-color)]">
                    {preferences.map((pref) => {
                        const labels = CATEGORY_LABELS[pref.category]
                        const Icon = CATEGORY_ICONS[pref.category] || Bell
                        const isSaving = saving === pref.category

                        return (
                            <div
                                key={pref.category}
                                className={cn(
                                    'p-4 grid grid-cols-[1fr_80px_80px] gap-4 items-center transition-opacity',
                                    isSaving && 'opacity-60'
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-[var(--neutral-50)] flex items-center justify-center flex-shrink-0">
                                        <Icon className="w-4.5 h-4.5 text-[var(--foreground-muted)]" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">{labels.label}</p>
                                        <p className="text-xs text-[var(--foreground-muted)]">{labels.description}</p>
                                    </div>
                                </div>

                                {/* In-App Toggle */}
                                <div className="flex justify-center">
                                    <button
                                        onClick={() => handleToggle(pref.category, 'in_app')}
                                        disabled={isSaving}
                                        className={cn(
                                            'w-11 h-6 rounded-full relative transition-colors',
                                            pref.in_app
                                                ? 'bg-[var(--color-primary)]'
                                                : 'bg-[var(--neutral-200)]'
                                        )}
                                        aria-label={`${pref.in_app ? 'Disable' : 'Enable'} in-app notifications for ${labels.label}`}
                                    >
                                        <div className={cn(
                                            'w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 transition-transform',
                                            pref.in_app ? 'translate-x-6' : 'translate-x-1'
                                        )} />
                                    </button>
                                </div>

                                {/* Push Toggle */}
                                <div className="flex justify-center">
                                    <button
                                        onClick={() => handleToggle(pref.category, 'push')}
                                        disabled={isSaving}
                                        className={cn(
                                            'w-11 h-6 rounded-full relative transition-colors',
                                            pref.push
                                                ? 'bg-[var(--color-primary)]'
                                                : 'bg-[var(--neutral-200)]'
                                        )}
                                        aria-label={`${pref.push ? 'Disable' : 'Enable'} push notifications for ${labels.label}`}
                                    >
                                        <div className={cn(
                                            'w-4 h-4 rounded-full bg-white shadow-sm absolute top-1 transition-transform',
                                            pref.push ? 'translate-x-6' : 'translate-x-1'
                                        )} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Info note */}
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <BellOff className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                    Disabling in-app notifications will prevent them from appearing in your notification bell.
                    Disabling push will stop browser and mobile push notifications for that category.
                    SOS alerts are recommended to stay enabled for urgent match coverage.
                </p>
            </div>
        </div>
    )
}
