'use client'

import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { ThemeToggle } from '@/lib/theme/ThemeProvider'
import { UserRole } from '@/lib/types'
import { NotificationDropdown } from './NotificationDropdown'

interface AppHeaderProps {
    userName?: string | null
    userRole?: UserRole | null
    notificationCount?: number // Deprecated, handled internally by NotificationDropdown
}

export function AppHeader({ userName, userRole }: AppHeaderProps) {
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

                    {/* Notifications */}
                    <NotificationDropdown />
                </div>
            </div>
        </header>
    )
}
