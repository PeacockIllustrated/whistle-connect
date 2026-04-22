'use client'

import Link from 'next/link'
import Image from 'next/image'
import { StatusChip } from '@/components/ui/StatusChip'
import { UserRole } from '@/lib/types'
import WalletBalanceNav from '@/components/app/WalletBalanceNav'
import { NotificationDropdown } from '@/components/app/NotificationDropdown'

interface AppHeaderProps {
    userName?: string | null
    userRole?: UserRole | null
}

export function AppHeader({ userRole }: AppHeaderProps) {
    return (
        <header
            className="fixed top-0 left-0 right-0 z-50 fixed-top-safe"
            style={{ height: 'calc(var(--header-height) + var(--safe-area-top))' }}
        >
            {/* Gradient background — extends to top edge so the safe-area
                inset reads as a continuous bar under the notch / dynamic island */}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--neutral-900)] via-[var(--neutral-800)] to-[var(--neutral-900)]" />

            {/* Glass overlay */}
            <div className="absolute inset-0 backdrop-blur-sm bg-black/20" />

            {/* Content — sits below the notch, pinned to the bottom of the
                expanded bar so it always reads as a normal-height header */}
            <div
                className="relative max-w-[var(--content-max-width)] mx-auto px-4 flex items-center justify-between"
                style={{ height: 'var(--header-height)', marginTop: 'var(--safe-area-top)' }}
            >
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
                    <WalletBalanceNav />
                    <NotificationDropdown />
                    {userRole && (
                        <StatusChip status={userRole} size="sm" />
                    )}
                </div>
            </div>
        </header>
    )
}
