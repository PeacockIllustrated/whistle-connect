'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUnreadMessages } from '@/components/app/UnreadMessagesProvider'
import { useBookingUpdates } from '@/components/app/BookingUpdatesProvider'
import { Home, CalendarDays, MessageCircle, User, Radar, Map, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface BottomNavProps {
    userRole?: string
}

interface NavItem {
    label: string
    href: string
    icon: LucideIcon
    animation: string
}

const getNavItems = (userRole?: string): NavItem[] => {
    const items: NavItem[] = [
        { label: 'Home', href: '/app', icon: Home, animation: 'icon-animate-bounce' },
        { label: 'Bookings', href: '/app/bookings', icon: CalendarDays, animation: 'icon-animate-pop' },
    ]

    if (userRole === 'admin') {
        items.push(
            {
                label: 'Map',
                href: '/app/admin/map',
                icon: Map,
                animation: 'icon-animate-pop',
            },
            {
                label: 'Referees',
                href: '/app/admin/referees',
                icon: ShieldCheck,
                animation: 'icon-animate-pop',
            },
        )
    }

    if (userRole === 'coach') {
        items.push({
            label: 'Map',
            href: '/app/map',
            icon: Map,
            animation: 'icon-animate-pop',
        })
    }

    if (userRole === 'referee') {
        items.push({
            label: 'Feed',
            href: '/app/feed',
            icon: Radar,
            animation: 'icon-animate-pop',
        })
    }

    items.push(
        { label: 'Messages', href: '/app/messages', icon: MessageCircle, animation: 'icon-animate-pop' },
        { label: 'Profile', href: '/app/profile', icon: User, animation: 'icon-animate-bounce' },
    )

    return items
}

export function BottomNav({ userRole }: BottomNavProps) {
    const pathname = usePathname()
    const { totalUnread } = useUnreadMessages()
    const { offerCount } = useBookingUpdates()
    const navItems = getNavItems(userRole)
    const [animatingHref, setAnimatingHref] = useState<string | null>(null)

    const isActive = (href: string) => {
        if (href === '/app') return pathname === '/app'
        return pathname.startsWith(href)
    }

    const handleTap = useCallback((href: string) => {
        setAnimatingHref(href)
    }, [])

    const handleAnimationEnd = useCallback(() => {
        setAnimatingHref(null)
    }, [])

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 h-[var(--bottom-nav-height)] safe-area-bottom">
            {/* Frosted glass background */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xl border-t border-[var(--border-color)]" />

            {/* Content */}
            <div className="relative h-full max-w-[var(--content-max-width)] mx-auto px-4 flex items-center justify-around">
                {navItems.map((item) => {
                    const active = isActive(item.href)
                    const Icon = item.icon
                    const isAnimating = animatingHref === item.href
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => handleTap(item.href)}
                            className={cn(
                                'relative flex flex-col items-center justify-center gap-1 py-2 px-4 rounded-xl transition-all duration-200 touch-target',
                                active
                                    ? 'text-[var(--color-primary)]'
                                    : 'text-[var(--neutral-400)] hover:text-[var(--neutral-600)]'
                            )}
                        >
                            {/* Active indicator */}
                            {active && (
                                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)]" />
                            )}

                            {/* Icon with animation + badge */}
                            <span
                                className={cn('relative', isAnimating && item.animation)}
                                onAnimationEnd={handleAnimationEnd}
                            >
                                <Icon
                                    className="w-6 h-6"
                                    strokeWidth={active ? 2.5 : 2}
                                />
                                {item.href === '/app/feed' && offerCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--wc-red)] text-white text-[10px] font-bold shadow-md animate-pulse">
                                        {offerCount > 9 ? '9+' : offerCount}
                                    </span>
                                )}
                                {item.href === '/app/messages' && totalUnread > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--wc-red)] text-white text-[10px] font-bold shadow-md animate-pulse">
                                        {totalUnread > 9 ? '9+' : totalUnread}
                                    </span>
                                )}
                            </span>

                            {/* Label */}
                            <span className={cn(
                                'text-[10px] font-medium transition-all text-center',
                                active ? 'font-semibold' : ''
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
