'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import {
    markAllNotificationsAsRead,
    clearAllNotifications,
    deleteNotification,
} from '@/app/app/notifications/actions'
import type { NotificationCategory } from '@/lib/notifications'
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
    Trash2,
    Check,
    CheckCheck,
    Settings,
    Filter,
} from 'lucide-react'

interface Notification {
    id: string
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
    category: NotificationCategory | null
    link?: string
    is_read: boolean
    created_at: string
}

interface NotificationListProps {
    initialNotifications: Notification[]
    userId: string
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Bell; label: string; color: string }> = {
    booking_update: { icon: CalendarDays, label: 'Booking', color: 'text-blue-600 bg-blue-50' },
    offer_update: { icon: Handshake, label: 'Offer', color: 'text-indigo-600 bg-indigo-50' },
    match_reminder: { icon: Bell, label: 'Reminder', color: 'text-amber-600 bg-amber-50' },
    new_match_nearby: { icon: MapPin, label: 'Nearby', color: 'text-emerald-600 bg-emerald-50' },
    sos_alert: { icon: AlertTriangle, label: 'SOS', color: 'text-red-600 bg-red-50' },
    message: { icon: MessageSquare, label: 'Message', color: 'text-purple-600 bg-purple-50' },
    verification: { icon: ShieldCheck, label: 'Verification', color: 'text-teal-600 bg-teal-50' },
    rating: { icon: Star, label: 'Rating', color: 'text-yellow-600 bg-yellow-50' },
    system: { icon: Megaphone, label: 'System', color: 'text-gray-600 bg-gray-50' },
}

const FILTER_OPTIONS: { value: string; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'booking_update', label: 'Bookings' },
    { value: 'offer_update', label: 'Offers' },
    { value: 'sos_alert', label: 'SOS' },
    { value: 'message', label: 'Messages' },
    { value: 'new_match_nearby', label: 'Nearby' },
    { value: 'match_reminder', label: 'Reminders' },
    { value: 'verification', label: 'Verification' },
    { value: 'rating', label: 'Ratings' },
]

export function NotificationList({ initialNotifications, userId }: NotificationListProps) {
    const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
    const [filter, setFilter] = useState('all')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const fetchNotificationsRef = useRef(async (currentFilter: string) => {
        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)

        if (currentFilter !== 'all') {
            query = query.eq('category', currentFilter)
        }

        const { data } = await query
        if (data) {
            setNotifications(data as Notification[])
        }
    })

    const handleFilterChange = (newFilter: string) => {
        setFilter(newFilter)
        fetchNotificationsRef.current(newFilter)
    }

    // Real-time subscription
    useEffect(() => {
        const channel = supabase
            .channel('notifications-page')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                () => {
                    fetchNotificationsRef.current(filter)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, supabase, filter])

    const handleMarkAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)
    }

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.is_read) {
            await handleMarkAsRead(notification.id)
        }
        if (notification.link) {
            router.push(notification.link)
        }
    }

    const handleMarkAllAsRead = async () => {
        setLoading(true)
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        await markAllNotificationsAsRead(
            filter !== 'all' ? (filter as NotificationCategory) : undefined
        )
        setLoading(false)
    }

    const handleClearRead = async () => {
        setLoading(true)
        setNotifications(prev => prev.filter(n => !n.is_read))
        await clearAllNotifications()
        setLoading(false)
    }

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        setNotifications(prev => prev.filter(n => n.id !== id))
        await deleteNotification(id)
    }

    const unreadCount = notifications.filter(n => !n.is_read).length

    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    }

    return (
        <div>
            {/* Filter Bar */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
                <Filter className="w-4 h-4 text-[var(--foreground-muted)] flex-shrink-0" />
                {FILTER_OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => handleFilterChange(opt.value)}
                        className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                            filter === opt.value
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'bg-[var(--neutral-100)] text-[var(--foreground-muted)] hover:bg-[var(--neutral-200)]'
                        )}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-[var(--foreground-muted)]">
                    {unreadCount > 0
                        ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                        : 'All caught up'}
                </span>
                <div className="flex gap-2">
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            loading={loading}
                        >
                            <CheckCheck className="w-4 h-4 mr-1" />
                            Mark all read
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearRead}
                        loading={loading}
                    >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Clear read
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/app/notifications/settings')}
                    >
                        <Settings className="w-4 h-4 mr-1" />
                        Settings
                    </Button>
                </div>
            </div>

            {/* Notification Items */}
            {notifications.length > 0 ? (
                <div className="space-y-2">
                    {notifications.map((notification) => {
                        const catConfig = CATEGORY_CONFIG[notification.category || 'system'] || CATEGORY_CONFIG.system
                        const Icon = catConfig.icon

                        return (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={cn(
                                    'card p-4 cursor-pointer hover:border-[var(--color-primary)] transition-all group flex gap-3',
                                    !notification.is_read && 'border-l-4 border-l-[var(--brand-accent)] bg-blue-50/30'
                                )}
                            >
                                {/* Category Icon */}
                                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', catConfig.color)}>
                                    <Icon className="w-5 h-5" />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className={cn(
                                                    'text-sm truncate',
                                                    !notification.is_read ? 'font-bold' : 'font-medium'
                                                )}>
                                                    {notification.title}
                                                </p>
                                                <span className={cn(
                                                    'text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap',
                                                    catConfig.color
                                                )}>
                                                    {catConfig.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--foreground-muted)] line-clamp-2">
                                                {notification.message}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <span className="text-[10px] text-[var(--neutral-400)] whitespace-nowrap">
                                                {formatTimeAgo(notification.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!notification.is_read && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleMarkAsRead(notification.id)
                                                }}
                                                className="text-[10px] text-[var(--color-primary)] font-medium flex items-center gap-1 hover:underline"
                                            >
                                                <Check className="w-3 h-3" />
                                                Mark read
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleDelete(e, notification.id)}
                                            className="text-[10px] text-red-500 font-medium flex items-center gap-1 hover:underline"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[var(--border-color)]">
                    <div className="w-16 h-16 bg-[var(--neutral-50)] rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bell className="w-8 h-8 text-[var(--neutral-400)]" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">No notifications</h3>
                    <p className="text-[var(--foreground-muted)] text-sm">
                        {filter !== 'all'
                            ? 'No notifications in this category.'
                            : 'You\'re all caught up! Check back later.'}
                    </p>
                </div>
            )}
        </div>
    )
}
