'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface BottomNavProps {
    unreadMessages?: number
    offerCount?: number
    userRole?: string
}

interface NavItem {
    label: string
    href: string
    icon: (active: boolean) => React.ReactNode
    badgeCount?: number
}

const getNavItems = (userRole?: string, offerCount: number = 0): NavItem[] => {
    const items: NavItem[] = [
        {
            label: 'Home',
            href: '/app',
            icon: (active: boolean) => (
                <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            ),
        },
        {
            label: 'Bookings',
            href: '/app/bookings',
            icon: (active: boolean) => (
                <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
        },
    ]

    // Add Offers tab for referees
    if (userRole === 'referee') {
        items.push({
            label: 'Offers',
            href: '/app/offers',
            icon: (active: boolean) => (
                <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
            ),
            badgeCount: offerCount,
        })
    }

    items.push(
        {
            label: 'Messages',
            href: '/app/messages',
            icon: (active: boolean) => (
                <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            ),
        },
        {
            label: 'Profile',
            href: '/app/profile',
            icon: (active: boolean) => (
                <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            ),
        }
    )

    return items
}

export function BottomNav({ unreadMessages = 0, offerCount = 0, userRole }: BottomNavProps) {
    const pathname = usePathname()
    const navItems = getNavItems(userRole, offerCount)

    const isActive = (href: string) => {
        if (href === '/app') {
            return pathname === '/app'
        }
        return pathname.startsWith(href)
    }

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 h-[var(--bottom-nav-height)] safe-area-bottom">
            {/* Frosted glass background */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xl border-t border-[var(--border-color)]" />

            {/* Content */}
            <div className="relative h-full max-w-[var(--content-max-width)] mx-auto px-4 flex items-center justify-around">
                {navItems.map((item: any) => {
                    const active = isActive(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
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

                            {/* Icon with badge */}
                            <span className="relative">
                                {item.icon(active)}
                                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--wc-red)] text-white text-[10px] font-bold shadow-md">
                                        {item.badgeCount > 9 ? '9+' : item.badgeCount}
                                    </span>
                                )}
                                {item.href === '/app/messages' && unreadMessages > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--wc-red)] text-white text-[10px] font-bold shadow-md">
                                        {unreadMessages > 9 ? '9+' : unreadMessages}
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
