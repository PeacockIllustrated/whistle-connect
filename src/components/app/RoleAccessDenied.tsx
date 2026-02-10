'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { UserRole } from '@/lib/types'
import { Lock } from 'lucide-react'

interface RoleAccessDeniedProps {
    requiredRole: UserRole
    currentRole?: UserRole
    featureName: string
    description: string
}

export function RoleAccessDenied({
    requiredRole,
    currentRole,
    featureName,
    description
}: RoleAccessDeniedProps) {
    const isCoachArea = requiredRole === 'coach'
    const isRefereeArea = requiredRole === 'referee'

    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
                {/* Icon */}
                <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${
                    isRefereeArea
                        ? 'bg-[var(--wc-red)]/10'
                        : 'bg-[var(--wc-blue)]/10'
                }`}>
                    <Lock className={`w-10 h-10 ${isRefereeArea ? 'text-[var(--wc-red)]' : 'text-[var(--wc-blue)]'}`} strokeWidth={1.5} />
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold mb-2">
                    {isRefereeArea ? 'Referee Area' : 'Coach Area'}
                </h1>

                {/* Description */}
                <p className="text-[var(--foreground-muted)] mb-6">
                    {description}
                </p>

                {/* Current Role Badge */}
                {currentRole && (
                    <p className="text-sm text-[var(--foreground-muted)] mb-6">
                        You are currently signed in as a{' '}
                        <span className={`font-bold ${
                            currentRole === 'referee'
                                ? 'text-[var(--wc-red)]'
                                : 'text-[var(--wc-blue)]'
                        }`}>
                            {currentRole === 'referee' ? 'Referee' : 'Coach'}
                        </span>
                    </p>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                    <Link href="/app" className="block">
                        <Button fullWidth variant="primary" size="lg">
                            Go to Dashboard
                        </Button>
                    </Link>

                    {isRefereeArea && currentRole === 'coach' && (
                        <p className="text-xs text-[var(--foreground-muted)]">
                            Want to referee games too?{' '}
                            <Link href="/auth/register?role=referee" className="text-[var(--wc-red)] font-semibold hover:underline">
                                Register as a Referee
                            </Link>
                        </p>
                    )}

                    {isCoachArea && currentRole === 'referee' && (
                        <p className="text-xs text-[var(--foreground-muted)]">
                            Want to book referees for your team?{' '}
                            <Link href="/auth/register?role=coach" className="text-[var(--wc-blue)] font-semibold hover:underline">
                                Register as a Coach
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
