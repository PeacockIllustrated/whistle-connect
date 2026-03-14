'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { sendTestNotification } from '@/app/app/admin/actions'
import {
    Bell,
    CalendarDays,
    MessageSquare,
    ShieldCheck,
    Star,
    Megaphone,
    MapPin,
    AlertTriangle,
    Handshake,
    Send,
    CheckCircle,
    XCircle,
    User,
} from 'lucide-react'

interface NotificationTestPanelProps {
    currentUserId: string
    users: Array<{ id: string; full_name: string; role: string }>
}

type TestCategory = 'booking_update' | 'offer_update' | 'match_reminder' | 'new_match_nearby' | 'sos_alert' | 'message' | 'verification' | 'rating' | 'system'

const TEST_CATEGORIES: {
    value: TestCategory
    label: string
    description: string
    icon: typeof Bell
    color: string
}[] = [
    {
        value: 'booking_update',
        label: 'Booking Update',
        description: 'Simulates a booking confirmation notification',
        icon: CalendarDays,
        color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
        value: 'offer_update',
        label: 'Offer Update',
        description: 'Simulates a new offer or price received',
        icon: Handshake,
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
        value: 'match_reminder',
        label: 'Match Reminder',
        description: 'Simulates a match day reminder',
        icon: Bell,
        color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
        value: 'new_match_nearby',
        label: 'New Match Nearby',
        description: 'Simulates a nearby match alert for referees',
        icon: MapPin,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
        value: 'sos_alert',
        label: 'SOS Alert',
        description: 'Simulates an urgent SOS notification (high priority push)',
        icon: AlertTriangle,
        color: 'text-red-600 bg-red-50 border-red-200',
    },
    {
        value: 'message',
        label: 'Message',
        description: 'Simulates a new message notification',
        icon: MessageSquare,
        color: 'text-purple-600 bg-purple-50 border-purple-200',
    },
    {
        value: 'verification',
        label: 'Verification',
        description: 'Simulates an FA verification status change',
        icon: ShieldCheck,
        color: 'text-teal-600 bg-teal-50 border-teal-200',
    },
    {
        value: 'rating',
        label: 'Rating',
        description: 'Simulates a new rating received notification',
        icon: Star,
        color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    },
    {
        value: 'system',
        label: 'System',
        description: 'Simulates a system announcement',
        icon: Megaphone,
        color: 'text-gray-600 bg-gray-50 border-gray-200',
    },
]

export function NotificationTestPanel({ currentUserId, users }: NotificationTestPanelProps) {
    const [targetUserId, setTargetUserId] = useState(currentUserId)
    const [sending, setSending] = useState<string | null>(null)
    const [results, setResults] = useState<Map<string, 'success' | 'error'>>(new Map())

    const handleSend = async (category: TestCategory) => {
        setSending(category)
        const result = await sendTestNotification(targetUserId, category)

        setResults(prev => {
            const next = new Map(prev)
            next.set(category, result.success ? 'success' : 'error')
            return next
        })

        setSending(null)

        // Clear result after 3 seconds
        setTimeout(() => {
            setResults(prev => {
                const next = new Map(prev)
                next.delete(category)
                return next
            })
        }, 3000)
    }

    const handleSendAll = async () => {
        for (const cat of TEST_CATEGORIES) {
            await handleSend(cat.value)
        }
    }

    const targetUser = users.find(u => u.id === targetUserId)

    return (
        <div className="space-y-6">
            {/* Target User Selector */}
            <div className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--neutral-50)] flex items-center justify-center">
                        <User className="w-5 h-5 text-[var(--foreground-muted)]" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">Target User</h3>
                        <p className="text-xs text-[var(--foreground-muted)]">
                            Choose who receives the test notifications
                        </p>
                    </div>
                </div>

                <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border-color)] rounded-lg text-sm bg-white"
                >
                    {users.map(user => (
                        <option key={user.id} value={user.id}>
                            {user.full_name} ({user.role}){user.id === currentUserId ? ' — You' : ''}
                        </option>
                    ))}
                </select>

                {targetUser && targetUserId !== currentUserId && (
                    <p className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Sending to <strong>{targetUser.full_name}</strong>. They will receive both in-app and push notifications (if enabled).
                    </p>
                )}
            </div>

            {/* Send All Button */}
            <div className="flex justify-end">
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSendAll}
                    loading={sending !== null}
                >
                    <Send className="w-4 h-4 mr-1" />
                    Send All Categories
                </Button>
            </div>

            {/* Test Categories */}
            <div className="space-y-3">
                {TEST_CATEGORIES.map((cat) => {
                    const Icon = cat.icon
                    const result = results.get(cat.value)
                    const isSending = sending === cat.value

                    return (
                        <div
                            key={cat.value}
                            className={`card p-4 flex items-center gap-4 border ${
                                result === 'success'
                                    ? 'border-green-300 bg-green-50/30'
                                    : result === 'error'
                                        ? 'border-red-300 bg-red-50/30'
                                        : ''
                            } transition-colors`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.color}`}>
                                <Icon className="w-5 h-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold">{cat.label}</p>
                                <p className="text-xs text-[var(--foreground-muted)]">{cat.description}</p>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                {result === 'success' && (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                )}
                                {result === 'error' && (
                                    <XCircle className="w-5 h-5 text-red-500" />
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSend(cat.value)}
                                    loading={isSending}
                                    disabled={sending !== null && !isSending}
                                >
                                    <Send className="w-3.5 h-3.5 mr-1" />
                                    Send
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Testing Tips */}
            <div className="card p-4 bg-[var(--neutral-50)]">
                <h3 className="font-semibold text-sm mb-2">Testing Tips</h3>
                <ul className="text-xs text-[var(--foreground-muted)] space-y-1.5">
                    <li><strong>In-app:</strong> Check the notification bell icon in the header for real-time delivery.</li>
                    <li><strong>Push (focused):</strong> You should see a browser/native notification while the app is open.</li>
                    <li><strong>Push (background):</strong> Close or minimise the app tab, then send a test to verify background delivery.</li>
                    <li><strong>SOS:</strong> Tests high-priority push with vibration patterns and require-interaction behaviour.</li>
                    <li><strong>Preferences:</strong> Toggle categories off in Settings to verify filtering works.</li>
                </ul>
            </div>
        </div>
    )
}
