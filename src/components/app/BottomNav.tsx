'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUnreadMessages } from '@/components/app/UnreadMessagesProvider'
import { Home, CalendarDays, Inbox, MessageCircle, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface BottomNavProps {
    offerCount?: number
    userRole?: string
}

interface NavItem {
    label: string
    href: string
    icon: LucideIcon
    animation: string
    badgeCount?: number
}

const getNavItems = (userRole?: string, offerCount: number = 0): NavItem[] => {
    const items: NavItem[] = [
        { label: 'Home', href: '/app', icon: Home, animation: 'icon-animate-bounce' },
        { label: 'Bookings', href: '/app/bookings', icon: CalendarDays, animation: 'icon-animate-pop' },
    ]

    if (userRole === 'referee') {
        items.push({
            label: 'Offers',
            href: '/app/offers',
            icon: Inbox,
            animation: 'icon-animate-wiggle',
            badgeCount: offerCount,
        })
    }

    items.push(
        { label: 'Messages', href: '/app/messages', icon: MessageCircle, animation: 'icon-animate-pop' },
        { label: 'Profile', href: '/app/profile', icon: User, animation: 'icon-animate-bounce' },
    )

    return items
}

export function BottomNav({ offerCount = 0, userRole }: BottomNavProps) {
    const pathname = usePathname()
    const { totalUnread } = useUnreadMessages()
    const navItems = getNavItems(userRole, offerCount)
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
                                    fill={active ? 'currentColor' : 'none'}
                                    strokeWidth={active ? 0 : 2}
                                />
                                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--wc-red)] text-white text-[10px] font-bold shadow-md">
                                        {item.badgeCount > 9 ? '9+' : item.badgeCount}
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
