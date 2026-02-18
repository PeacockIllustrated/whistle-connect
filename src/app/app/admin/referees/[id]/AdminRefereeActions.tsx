'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FAStatusBadge } from '@/components/ui/FAStatusBadge'
import { verifyReferee, updateFAVerificationStatus, createFAVerificationRequest, resolveVerificationRequest } from '../../actions'
import type { RefereeProfile, FAVerificationRequest, FAVerificationStatus } from '@/lib/types'
import { Mail, CheckCircle, XCircle, Clock } from 'lucide-react'

interface AdminRefereeActionsProps {
    refereeId: string
    refereeProfile: RefereeProfile | null
    refereeName: string
    verificationRequests: FAVerificationRequest[]
}

export function AdminRefereeActions({
    refereeId,
    refereeProfile,
    refereeName,
    verificationRequests,
}: AdminRefereeActionsProps) {
    const [verifying, setVerifying] = useState(false)
    const [faLoading, setFaLoading] = useState(false)
    const [error, setError] = useState('')
    const [resolveNotes, setResolveNotes] = useState('')
    const [resolvingId, setResolvingId] = useState<string | null>(null)

    async function handleVerify() {
        setVerifying(true)
        try {
            await verifyReferee(refereeId, !refereeProfile?.verified)
        } catch (err) {
            console.error('Failed to update verification:', err)
        } finally {
            setVerifying(false)
        }
    }

    async function handleFAStatus(status: FAVerificationStatus) {
        setFaLoading(true)
        setError('')
        const result = await updateFAVerificationStatus(refereeId, status)
        if (result.error) setError(result.error)
        setFaLoading(false)
    }

    async function handleVerifyWithFA() {
        setFaLoading(true)
        setError('')
        const result = await createFAVerificationRequest(refereeId)
        setFaLoading(false)

        if (result.error) {
            setError(result.error)
            return
        }

        if (result.mailto) {
            const { email, refereeName: name, faId, county } = result.mailto
            const subject = encodeURIComponent('FA Number Verification Request')
            const body = encodeURIComponent(
                `Dear ${county} FA,\n\n` +
                `We would like to verify the following referee registration:\n\n` +
                `Referee Name: ${name}\n` +
                `FA Number: ${faId}\n` +
                `County: ${county}\n\n` +
                `Could you please confirm whether this FA number is valid and currently registered?\n\n` +
                `Thank you,\nWhistle Connect`
            )
            window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank')
        }
    }

    async function handleResolveRequest(requestId: string, resolution: 'confirmed' | 'rejected') {
        setResolvingId(requestId)
        setError('')
        const result = await resolveVerificationRequest(requestId, resolution, resolveNotes || undefined)
        if (result.error) setError(result.error)
        setResolvingId(null)
        setResolveNotes('')
    }

    const faStatus = refereeProfile?.fa_verification_status || 'not_provided'
    const openRequests = verificationRequests.filter(r => r.status === 'awaiting_fa_response')
    const pastRequests = verificationRequests.filter(r => r.status !== 'awaiting_fa_response')

    return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* General Verification Toggle */}
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

            {/* FA Verification */}
            <div className="card p-4">
                <h3 className="font-semibold mb-3">FA Verification</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
                        <span className="text-sm text-[var(--foreground-muted)]">FA Number</span>
                        <span className="text-sm font-medium font-mono">
                            {refereeProfile?.fa_id || 'Not provided'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)]">
                        <span className="text-sm text-[var(--foreground-muted)]">FA Status</span>
                        <FAStatusBadge status={faStatus} />
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-[var(--foreground-muted)]">Level</span>
                        <span className="text-sm font-medium">{refereeProfile?.level || 'Not set'}</span>
                    </div>
                </div>

                {/* FA Action Buttons */}
                {refereeProfile?.fa_id && (
                    <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                        {faStatus === 'pending' && (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    loading={faLoading}
                                    onClick={() => handleFAStatus('verified')}
                                >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Verify FA
                                </Button>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    loading={faLoading}
                                    onClick={() => handleFAStatus('rejected')}
                                >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Reject FA
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    loading={faLoading}
                                    onClick={handleVerifyWithFA}
                                >
                                    <Mail className="w-4 h-4 mr-1" />
                                    Verify with County FA
                                </Button>
                            </div>
                        )}
                        {faStatus === 'verified' && (
                            <Button
                                variant="danger"
                                size="sm"
                                loading={faLoading}
                                onClick={() => handleFAStatus('pending')}
                            >
                                Revoke FA Verification
                            </Button>
                        )}
                        {faStatus === 'rejected' && (
                            <div className="flex gap-2">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    loading={faLoading}
                                    onClick={() => handleFAStatus('verified')}
                                >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Verify FA
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    loading={faLoading}
                                    onClick={handleVerifyWithFA}
                                >
                                    <Mail className="w-4 h-4 mr-1" />
                                    Re-check with County FA
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Open Verification Requests */}
            {openRequests.length > 0 && (
                <div className="card p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        Awaiting County FA Response
                    </h3>
                    <div className="space-y-3">
                        {openRequests.map(req => (
                            <div key={req.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="text-sm font-medium">FAN: {req.fa_id}</p>
                                        <p className="text-xs text-[var(--foreground-muted)]">
                                            Sent to {req.county} FA on {new Date(req.requested_at).toLocaleDateString('en-GB')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <input
                                        type="text"
                                        placeholder="Notes (optional)"
                                        value={resolvingId === req.id ? resolveNotes : ''}
                                        onChange={(e) => { setResolvingId(req.id); setResolveNotes(e.target.value) }}
                                        className="flex-1 px-2 py-1 text-sm border border-[var(--border-color)] rounded-md"
                                    />
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        loading={resolvingId === req.id}
                                        onClick={() => handleResolveRequest(req.id, 'confirmed')}
                                    >
                                        Confirmed
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        loading={resolvingId === req.id}
                                        onClick={() => handleResolveRequest(req.id, 'rejected')}
                                    >
                                        Rejected
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Past Verification Requests */}
            {pastRequests.length > 0 && (
                <div className="card p-4">
                    <h3 className="font-semibold mb-3">Verification History</h3>
                    <div className="space-y-2">
                        {pastRequests.map(req => (
                            <div key={req.id} className="flex items-center justify-between py-2 border-b border-[var(--border-color)] last:border-0">
                                <div>
                                    <p className="text-sm">
                                        FAN: {req.fa_id} — {req.county} FA
                                    </p>
                                    <p className="text-xs text-[var(--foreground-muted)]">
                                        {new Date(req.requested_at).toLocaleDateString('en-GB')}
                                        {req.resolved_at && ` → ${new Date(req.resolved_at).toLocaleDateString('en-GB')}`}
                                    </p>
                                    {req.notes && (
                                        <p className="text-xs text-[var(--foreground-muted)] italic mt-0.5">{req.notes}</p>
                                    )}
                                </div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                    req.status === 'confirmed'
                                        ? 'text-green-700 bg-green-50 border-green-200'
                                        : 'text-red-600 bg-red-50 border-red-200'
                                }`}>
                                    {req.status === 'confirmed' ? 'Confirmed' : 'Rejected'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
