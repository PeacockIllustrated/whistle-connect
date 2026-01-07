'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { StatusChip } from '@/components/ui/StatusChip'
import { verifyReferee, updateComplianceStatus } from '../../actions'
import { RefereeProfile, ComplianceStatus } from '@/lib/types'

const complianceStatusOptions = [
    { value: 'not_provided', label: 'Not Provided' },
    { value: 'provided', label: 'Provided' },
    { value: 'verified', label: 'Verified' },
    { value: 'expired', label: 'Expired' },
]

interface AdminRefereeActionsProps {
    refereeId: string
    refereeProfile: RefereeProfile | null
}

export function AdminRefereeActions({ refereeId, refereeProfile }: AdminRefereeActionsProps) {
    const [verifying, setVerifying] = useState(false)
    const [updatingDBS, setUpdatingDBS] = useState(false)
    const [updatingSafeguarding, setUpdatingSafeguarding] = useState(false)

    const [dbsStatus, setDbsStatus] = useState<string>(refereeProfile?.dbs_status || 'not_provided')
    const [dbsExpiry, setDbsExpiry] = useState(refereeProfile?.dbs_expires_at || '')
    const [safeguardingStatus, setSafeguardingStatus] = useState<string>(refereeProfile?.safeguarding_status || 'not_provided')
    const [safeguardingExpiry, setSafeguardingExpiry] = useState(refereeProfile?.safeguarding_expires_at || '')

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

    async function handleUpdateDBS() {
        setUpdatingDBS(true)
        try {
            await updateComplianceStatus(refereeId, 'dbs_status', dbsStatus as ComplianceStatus, dbsExpiry)
        } catch (error) {
            console.error('Failed to update DBS:', error)
        } finally {
            setUpdatingDBS(false)
        }
    }

    async function handleUpdateSafeguarding() {
        setUpdatingSafeguarding(true)
        try {
            await updateComplianceStatus(refereeId, 'safeguarding_status', safeguardingStatus as ComplianceStatus, safeguardingExpiry)
        } catch (error) {
            console.error('Failed to update safeguarding:', error)
        } finally {
            setUpdatingSafeguarding(false)
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

            {/* DBS Check */}
            <div className="card p-4">
                <h3 className="font-semibold mb-3">DBS Check</h3>
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--foreground-muted)]">Current:</span>
                        <StatusChip status={refereeProfile?.dbs_status || 'not_provided'} size="sm" />
                    </div>

                    <Select
                        label="Status"
                        options={complianceStatusOptions}
                        value={dbsStatus}
                        onChange={(e) => setDbsStatus(e.target.value)}
                    />

                    <Input
                        label="Expiry Date"
                        type="date"
                        value={dbsExpiry}
                        onChange={(e) => setDbsExpiry(e.target.value)}
                    />

                    <Button
                        fullWidth
                        variant="outline"
                        loading={updatingDBS}
                        onClick={handleUpdateDBS}
                    >
                        Update DBS Status
                    </Button>
                </div>
            </div>

            {/* Safeguarding */}
            <div className="card p-4">
                <h3 className="font-semibold mb-3">Safeguarding</h3>
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--foreground-muted)]">Current:</span>
                        <StatusChip status={refereeProfile?.safeguarding_status || 'not_provided'} size="sm" />
                    </div>

                    <Select
                        label="Status"
                        options={complianceStatusOptions}
                        value={safeguardingStatus}
                        onChange={(e) => setSafeguardingStatus(e.target.value)}
                    />

                    <Input
                        label="Expiry Date"
                        type="date"
                        value={safeguardingExpiry}
                        onChange={(e) => setSafeguardingExpiry(e.target.value)}
                    />

                    <Button
                        fullWidth
                        variant="outline"
                        loading={updatingSafeguarding}
                        onClick={handleUpdateSafeguarding}
                    >
                        Update Safeguarding Status
                    </Button>
                </div>
            </div>
        </div>
    )
}
