'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
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
    ExternalLink,
} from 'lucide-react'
import type { NotificationCategory } from '@/lib/notifications'

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

const CATEGORY_COLORS: Record<string, string> = {
    booking_update: 'text-blue-600 bg-blue-50',
    offer_update: 'text-indigo-600 bg-indigo-50',
    match_reminder: 'text-amber-600 bg-amber-50',
    new_match_nearby: 'text-emerald-600 bg-emerald-50',
    sos_alert: 'text-red-600 bg-red-50',
    message: 'text-purple-600 bg-purple-50',
    verification: 'text-teal-600 bg-teal-50',
    rating: 'text-yellow-600 bg-yellow-50',
    system: 'text-gray-600 bg-gray-50',
}

export function NotificationDropdown() {
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [userId, setUserId] = useState<string | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()
    const router = useRouter()

    const fetchNotifications = useCallback(async (uid: string) => {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(15)

        if (data) {
            setNotifications(data as Notification[])
            setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
        }
    }, [supabase])

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUserId(user.id)
                fetchNotifications(user.id)
            }
        }
        getUser()
    }, [supabase.auth, fetchNotifications])

    useEffect(() => {
        if (!userId) return

        const channel = supabase
            .channel('notifications-user')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                () => {
                    fetchNotifications(userId)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, supabase, fetchNotifications])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const markAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)
    }

    const markAllAsRead = async () => {
        if (!userId) return

        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false)
    }

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.is_read) {
            await markAsRead(notification.id)
        }
        setIsOpen(false)
        if (notification.link) {
            router.push(notification.link)
        }
    }

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
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5 text-white" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-[var(--brand-accent)] to-orange-600 text-white text-[10px] font-bold flex items-center justify-center shadow-lg animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-[var(--border-color)] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--neutral-50)]">
                        <h3 className="font-semibold text-sm">Notifications</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-[var(--color-primary)] font-medium hover:underline"
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length > 0 ? (
                            <div className="divide-y divide-[var(--border-color)]">
                                {notifications.map((notification) => {
                                    const category = notification.category || 'system'
                                    const Icon = CATEGORY_ICONS[category] || Bell
                                    const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS.system

                                    return (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={cn(
                                                "p-3 hover:bg-[var(--neutral-50)] transition-colors cursor-pointer flex gap-3",
                                                !notification.is_read ? "bg-blue-50/50" : ""
                                            )}
                                        >
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                                                colorClass
                                            )}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-1">
                                                    <p className={cn(
                                                        "text-sm truncate",
                                                        !notification.is_read ? "font-semibold" : "font-medium"
                                                    )}>
                                                        {notification.title}
                                                    </p>
                                                    <span className="text-[10px] text-[var(--neutral-400)] whitespace-nowrap flex-shrink-0">
                                                        {formatTimeAgo(notification.created_at)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[var(--foreground-muted)] line-clamp-2 mt-0.5">
                                                    {notification.message}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <p className="text-sm text-[var(--foreground-muted)]">No notifications yet</p>
                            </div>
                        )}
                    </div>

                    {/* View All Link */}
                    <div className="p-2 border-t border-[var(--border-color)] bg-[var(--neutral-50)]">
                        <button
                            onClick={() => {
                                setIsOpen(false)
                                router.push('/app/notifications')
                            }}
                            className="w-full text-center text-xs font-medium text-[var(--color-primary)] py-1.5 hover:underline flex items-center justify-center gap-1"
                        >
                            View all notifications
                            <ExternalLink className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
