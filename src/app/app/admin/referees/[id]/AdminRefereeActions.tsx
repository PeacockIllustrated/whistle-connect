'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { verifyReferee } from '../../actions'
import { RefereeProfile } from '@/lib/types'
import { CheckCircle } from 'lucide-react'

interface AdminRefereeActionsProps {
    refereeId: string
    refereeProfile: RefereeProfile | null
}

export function AdminRefereeActions({ refereeId, refereeProfile }: AdminRefereeActionsProps) {
    const [verifying, setVerifying] = useState(false)

    async function handleVerify() {
        setVerifying(true)
        try {
            await verifyReferee(refereeId, !refereeProfile?.verified)
        } catch (error) {
            console.error('Failed to update verification:', error)
        } finally {
            setVerifying(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Verification Toggle */}
            <div className="card p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold">Verification Status</h3>
                        <p className="text-sm text-[var(--foreground-muted)]">
                            {refereeProfile?.verified ? 'This referee is verified' : 'This referee is not verified'}
                        </p>
                    </div>
                    <Button
                        variant={refereeProfile?.verified ? 'danger' : 'primary'}
                        size="sm"
                        loading={verifying}
                        onClick={handleVerify}
                    >
                        {refereeProfile?.verified ? 'Remove Verification' : 'Verify Referee'}
                    </Button>
                </div>
            </div>

            {/* FA Details */}
            <div className="card p-4">
                <h3 className="font-semibold mb-3">FA Details</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
                        <span className="text-sm text-[var(--foreground-muted)]">FA Number</span>
                        <span className="text-sm font-medium">{refereeProfile?.fa_id || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
                        <span className="text-sm text-[var(--foreground-muted)]">FA Verified</span>
                        {refereeProfile?.fa_id ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                <CheckCircle className="w-3 h-3" fill="currentColor" stroke="white" strokeWidth={1.5} />
                                Verified
                            </span>
                        ) : (
                            <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                Pending
                            </span>
                        )}
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-[var(--foreground-muted)]">Level</span>
                        <span className="text-sm font-medium">{refereeProfile?.level || 'Not set'}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
