'use client'

import Link from 'next/link'
import Image from 'next/image'
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
                <Link href="/app" className="flex items-center group">
                    <Image
                        src="/assets/logo-main-white.svg"
                        alt="Whistle Connect"
                        width={130}
                        height={45}
                        className="group-hover:opacity-90 transition-opacity"
                        priority
                    />
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
