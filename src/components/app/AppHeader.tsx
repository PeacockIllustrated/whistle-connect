'use client'

import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { ThemeToggle } from '@/lib/theme/ThemeProvider'
import { UserRole } from '@/lib/types'

interface AppHeaderProps {
    userName?: string | null
    userRole?: UserRole | null
    notificationCount?: number
}

export function AppHeader({ userName, userRole, notificationCount = 0 }: AppHeaderProps) {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-[var(--header-height)]">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--neutral-900)] via-[var(--neutral-800)] to-[var(--neutral-900)]" />

            {/* Glass overlay */}
            <div className="absolute inset-0 backdrop-blur-sm bg-black/20" />

            {/* Content */}
            <div className="relative h-full max-w-[var(--content-max-width)] mx-auto px-4 flex items-center justify-between">
                {/* Brand */}
                <Link href="/app" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] flex items-center justify-center shadow-md group-hover:shadow-[var(--shadow-glow)] transition-shadow">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        </svg>
                    </div>
                    <div className="hidden sm:block">
                        <h1 className="text-white font-bold text-lg leading-tight">Whistle</h1>
                        <p className="text-white/50 text-xs leading-tight">Connect</p>
                    </div>
                </Link>

                {/* Right side */}
                <div className="flex items-center gap-2">
                    {userRole && (
                        <StatusChip status={userRole} size="sm" />
                    )}

                    {/* Theme Toggle */}
                    <ThemeToggle />
                    <Link
                        href="/app/messages"
                        className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        {notificationCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-[var(--brand-accent)] to-orange-600 text-white text-[10px] font-bold flex items-center justify-center shadow-lg animate-pulse">
                                {notificationCount > 9 ? '9+' : notificationCount}
                            </span>
                        )}
                    </Link>
                </div>
            </div>
        </header>
    )
}
