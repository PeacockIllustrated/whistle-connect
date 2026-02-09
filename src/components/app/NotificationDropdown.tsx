'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Bell } from 'lucide-react'

interface Notification {
    id: string
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
    link?: string
    is_read: boolean
    created_at: string
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
        // Get user once on mount
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

        // Subscribe to real-time changes for this user
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
                (payload) => {
                    console.log('Notification received:', payload)
                    fetchNotifications(userId)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, supabase, fetchNotifications])

    useEffect(() => {
        // Close dropdown when clicking outside
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
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)
    }

    const markAllAsRead = async () => {
        if (!userId) return

        // Optimistic update
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
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-[var(--color-primary)] font-medium hover:underline"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length > 0 ? (
                            <div className="divide-y divide-[var(--border-color)]">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={cn(
                                            "p-4 hover:bg-[var(--neutral-50)] transition-colors cursor-pointer flex gap-3",
                                            !notification.is_read ? "bg-blue-50/50" : ""
                                        )}
                                    >
                                        <div className={cn(
                                            "w-2 h-2 mt-2 rounded-full flex-shrink-0",
                                            !notification.is_read ? "bg-[var(--brand-accent)]" : "bg-transparent"
                                        )} />
                                        <div className="flex-1">
                                            <p className={cn("text-sm mb-1", !notification.is_read ? "font-semibold" : "font-medium")}>
                                                {notification.title}
                                            </p>
                                            <p className="text-xs text-[var(--foreground-muted)] line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <p className="text-[10px] text-[var(--neutral-400)] mt-2">
                                                {new Date(notification.created_at).toLocaleDateString()} at {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <p className="text-sm text-[var(--foreground-muted)]">No notifications yet</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
