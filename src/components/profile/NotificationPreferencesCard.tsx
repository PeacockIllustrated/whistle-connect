'use client'

import { useState, useTransition } from 'react'
import { Card } from '@/components/ui/Card'
import { Bell } from 'lucide-react'
import { updateNotificationPreferences } from '@/app/app/profile/actions'

interface NotificationPreferencesCardProps {
    /** Current opt-out state from profiles.reengagement_opt_out. */
    initialOptOut: boolean
}

/**
 * Re-engagement notification opt-out. The toggle is framed positively ("on" =
 * subscribed), so the stored `reengagement_opt_out` is the inverse of the
 * switch. Transactional notifications (bookings, payments, disputes) are NOT
 * affected by this and are always delivered.
 */
export function NotificationPreferencesCard({ initialOptOut }: NotificationPreferencesCardProps) {
    const [optOut, setOptOut] = useState(initialOptOut)
    const [error, setError] = useState('')
    const [pending, startTransition] = useTransition()

    const subscribed = !optOut

    function handleToggle() {
        const nextOptOut = !optOut
        setOptOut(nextOptOut) // optimistic
        setError('')
        startTransition(async () => {
            const result = await updateNotificationPreferences(nextOptOut)
            if (result.error) {
                setOptOut(!nextOptOut) // revert
                setError(result.error)
            }
        })
    }

    return (
        <Card variant="default" padding="md" className="mb-4">
            <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-4">
                Notifications
            </h2>
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5 text-[var(--color-primary)]" />
                    </div>
                    <div>
                        <p className="text-sm font-medium">Tips & reminders</p>
                        <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
                            Occasional nudges about open matches near you and unfinished bookings.
                            Booking, payment and dispute alerts are always sent.
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleToggle}
                    disabled={pending}
                    role="switch"
                    aria-checked={subscribed}
                    aria-label={subscribed ? 'Turn off tips and reminders' : 'Turn on tips and reminders'}
                    className={`relative w-14 h-8 rounded-full transition-colors duration-200 shrink-0 ${
                        subscribed ? 'bg-emerald-500' : 'bg-[var(--neutral-300)]'
                    } ${pending ? 'opacity-60' : ''}`}
                >
                    <span
                        className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
                            subscribed ? 'translate-x-6' : 'translate-x-0'
                        }`}
                    />
                </button>
            </div>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </Card>
    )
}
