'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { StatusChip } from '@/components/ui/StatusChip'
import { FAStatusBadge } from '@/components/ui/FAStatusBadge'
import { ActionCard } from '@/components/app/ActionCard'
import { ProfileEditForm } from './ProfileEditForm'
import { AvatarUpload } from '@/components/profile/AvatarUpload'
import { PrivacyToggleRow } from '@/components/profile/PrivacyToggleRow'
import { AchievementsHighlight } from '@/components/achievements/AchievementsHighlight'
import { Modal } from '@/components/ui/Modal'
import { updateFANumber, deleteMyAccount, exportMyData } from './actions'
import { requestPasswordReset } from '@/lib/auth/actions'
import {
    Pencil, ShieldCheck, BadgeCheck, Trash2, AlertTriangle, Download, KeyRound,
    Wallet, FileText, ScrollText, CalendarClock, Award, FileCheck,
    type LucideIcon,
} from 'lucide-react'
import Image from 'next/image'
import type { Profile, RefereeProfile, DBSStatus } from '@/lib/types'
import type { Achievements } from '@/lib/achievements'

interface ProfileClientProps {
    user: { id: string; email?: string }
    profile: Profile
    refereeProfile: RefereeProfile | null
    achievements: Achievements
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
    return (
        <div className="mb-4 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-[var(--brand-primary)]" />
            {Icon && <Icon className="h-4 w-4 text-[var(--foreground-muted)]" />}
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">{children}</h2>
        </div>
    )
}

type CredState = 'good' | 'warn' | 'neutral'

const CRED_TONE: Record<CredState, string> = {
    good: 'text-emerald-600 bg-emerald-50',
    warn: 'text-amber-600 bg-amber-50',
    neutral: 'text-[var(--foreground-muted)] bg-[var(--neutral-100)]',
}

function CredTile({ icon: Icon, label, value, state }: { icon: LucideIcon; label: string; value: string; state: CredState }) {
    return (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--background-elevated)] p-3">
            <div className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg ${CRED_TONE[state]}`}>
                <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="text-[11px] uppercase tracking-wide text-[var(--foreground-muted)]">{label}</div>
            <div className="text-sm font-semibold text-[var(--foreground)]">{value}</div>
        </div>
    )
}

function credFromStatus(status: DBSStatus): { value: string; state: CredState } {
    switch (status) {
        case 'verified': return { value: 'Verified', state: 'good' }
        case 'expired': return { value: 'Expired', state: 'warn' }
        case 'provided': return { value: 'Provided', state: 'neutral' }
        default: return { value: 'Not provided', state: 'neutral' }
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function ProfileClient({ user, profile: initialProfile, refereeProfile, achievements }: ProfileClientProps) {
    const router = useRouter()
    const [isEditing, setIsEditing] = useState(false)
    const [profile, setProfile] = useState(initialProfile)

    const isReferee = profile.role === 'referee'
    const isCoach = profile.role === 'coach'

    // Profile completeness — role-aware checklist.
    const checks: boolean[] = [!!profile.avatar_url, !!profile.phone, !!profile.postcode]
    if (isCoach) checks.push(!!profile.club_name)
    if (isReferee) checks.push(!!refereeProfile?.fa_id)
    const completePct = Math.round((checks.filter(Boolean).length / checks.length) * 100)

    if (isEditing) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-xl font-bold">Edit Profile</h1>
                </div>

                <div className="flex justify-center mb-8">
                    <AvatarUpload
                        userId={user.id}
                        currentAvatarUrl={profile.avatar_url}
                        onSuccess={(url) => setProfile({ ...profile, avatar_url: url })}
                    />
                </div>

                <Card variant="default" padding="md">
                    <ProfileEditForm
                        initialData={{
                            full_name: profile.full_name,
                            postcode: profile.postcode || '',
                            phone: profile.phone || '',
                            club_name: profile.club_name || '',
                        }}
                        role={profile.role}
                        onCancel={() => setIsEditing(false)}
                        onSuccess={() => {
                            setIsEditing(false)
                            router.refresh()
                        }}
                    />
                </Card>
            </div>
        )
    }

    return (
        <>
            {/* Profile hero */}
            <Card variant="elevated" padding="md" className="mb-4">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                        {profile.avatar_url ? (
                            <Image src={profile.avatar_url} alt={profile.full_name} width={64} height={64} className="h-full w-full object-cover" unoptimized />
                        ) : (
                            profile.full_name?.charAt(0) || '?'
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-xl font-bold">{profile.full_name}</h1>
                        <p className="truncate text-sm text-[var(--foreground-muted)]">{user.email}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                            {profile.role && <StatusChip status={profile.role} size="sm" />}
                            {profile.created_at && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--foreground-subtle)]">
                                    <CalendarClock className="h-3 w-3" />
                                    Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="shrink-0 rounded-full bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/20"
                    >
                        Edit
                    </button>
                </div>

                {completePct < 100 && (
                    <div className="mt-4">
                        <div className="mb-1 flex items-center justify-between text-[11px] font-medium">
                            <span className="text-[var(--foreground-muted)]">Profile {completePct}% complete</span>
                            <button onClick={() => setIsEditing(true)} className="text-[var(--color-primary)] hover:underline">Finish</button>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--neutral-200)]">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-light)] transition-all"
                                style={{ width: `${completePct}%` }}
                            />
                        </div>
                    </div>
                )}
            </Card>

            {/* Account details */}
            <Card variant="default" padding="md" className="mb-4">
                <SectionTitle>Account Details</SectionTitle>
                <div className="space-y-1">
                    <PrivacyToggleRow label="Phone" value={profile.phone} />
                    <PrivacyToggleRow label="Postcode" value={profile.postcode} />
                    {isCoach && (
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-[var(--foreground-muted)]">Club</span>
                            <span className="text-sm font-medium">{profile.club_name || 'Not set'}</span>
                        </div>
                    )}
                </div>
            </Card>

            {/* Referee credentials */}
            {isReferee && refereeProfile && (
                <RefereeCredentials refereeProfile={refereeProfile} onUpdate={() => router.refresh()} />
            )}

            {/* Wallet & payments */}
            <div className="mb-4">
                <ActionCard
                    href="/app/wallet"
                    icon={<Wallet className="h-6 w-6" />}
                    title="Wallet & payments"
                    subtitle={isReferee ? 'Earnings, withdrawals & payout setup' : 'Top up and manage your balance'}
                />
            </div>

            {/* Achievements */}
            <AchievementsHighlight data={achievements} />

            {/* Security */}
            <SecurityCard email={user.email} />

            {/* Your data */}
            <DataExport />

            {/* About / legal */}
            <Card variant="default" padding="none" className="mb-4 overflow-hidden">
                <LegalRow href="/terms" icon={ScrollText} label="Terms of Service" />
                <LegalRow href="/privacy" icon={FileText} label="Privacy Policy" last />
            </Card>

            {/* Danger zone */}
            <DangerZone />
        </>
    )
}

function LegalRow({ href, icon: Icon, label, last }: { href: string; icon: LucideIcon; label: string; last?: boolean }) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-3 p-4 transition-colors hover:bg-[var(--neutral-50)] ${last ? '' : 'border-b border-[var(--border-color)]'}`}
        >
            <Icon className="h-4 w-4 text-[var(--foreground-muted)]" />
            <span className="text-sm font-medium">{label}</span>
        </Link>
    )
}

function SecurityCard({ email }: { email?: string }) {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    async function handleReset() {
        if (!email) {
            setError('No email address is on file for this account.')
            return
        }
        setLoading(true)
        setError('')
        setMessage('')
        const result = await requestPasswordReset(email)
        setLoading(false)
        if (result?.error) {
            setError(result.error)
            return
        }
        setMessage(result?.message || `We've emailed ${email} a secure link to set a new password.`)
    }

    return (
        <Card variant="default" padding="md" className="mb-4">
            <SectionTitle icon={KeyRound}>Security</SectionTitle>
            <p className="mb-4 text-sm text-[var(--foreground-muted)]">
                We&apos;ll email you a secure link to choose a new password.
            </p>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            {message && <p className="mb-3 text-sm text-emerald-600">{message}</p>}
            <button
                onClick={handleReset}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--neutral-100)] disabled:opacity-50"
            >
                <KeyRound className="h-4 w-4" />
                {loading ? 'Sending…' : 'Reset password'}
            </button>
        </Card>
    )
}

function DataExport() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleExport() {
        setLoading(true)
        setError('')
        const result = await exportMyData()
        setLoading(false)
        if (result.error || !result.data) {
            setError(result.error || 'Could not export your data. Please try again.')
            return
        }
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `whistle-connect-data-${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    }

    return (
        <Card variant="default" padding="md" className="mb-4">
            <SectionTitle icon={Download}>Your Data</SectionTitle>
            <p className="mb-4 text-sm text-[var(--foreground-muted)]">
                Download a copy of your personal data (profile, bookings, offers, messages and wallet history) as a JSON file.
            </p>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <button
                onClick={handleExport}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--neutral-100)] disabled:opacity-50"
            >
                <Download className="h-4 w-4" />
                {loading ? 'Preparing…' : 'Download my data'}
            </button>
        </Card>
    )
}

function DangerZone() {
    const [showModal, setShowModal] = useState(false)
    const [confirmText, setConfirmText] = useState('')
    const [error, setError] = useState('')
    const [deleting, setDeleting] = useState(false)

    const canDelete = confirmText === 'DELETE'

    function closeModal() {
        if (deleting) return
        setShowModal(false)
        setConfirmText('')
        setError('')
    }

    async function handleDelete() {
        if (!canDelete || deleting) return
        setError('')
        setDeleting(true)
        const result = await deleteMyAccount()
        if (result.error) {
            setDeleting(false)
            setError(result.error)
            return
        }
        window.location.href = '/'
    }

    return (
        <>
            <Card variant="default" padding="md" className="mt-6 border-red-300">
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    Danger Zone
                </h2>
                <p className="mb-4 text-sm text-[var(--foreground-muted)]">
                    Permanently delete your account and personal data. This cannot be undone.
                </p>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                    <Trash2 className="h-4 w-4" />
                    Delete account
                </button>
            </Card>

            <Modal isOpen={showModal} onClose={closeModal} title="Delete account" size="md">
                <div className="space-y-4">
                    <p className="text-sm text-[var(--foreground)]">
                        This will <span className="font-semibold">permanently delete</span> your
                        account and remove your personal details. You will be signed out and will
                        not be able to log back in. This action cannot be undone.
                    </p>

                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                        <p className="mb-1 text-xs font-semibold text-red-700">Before you can delete:</p>
                        <ul className="list-inside list-disc space-y-0.5 text-xs text-red-700">
                            <li>Your wallet balance must be £0 (withdraw any funds first)</li>
                            <li>You must have no active bookings or funds held in escrow</li>
                        </ul>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm text-[var(--foreground-muted)]">
                            Type <span className="font-semibold text-[var(--foreground)]">DELETE</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="DELETE"
                            autoComplete="off"
                            disabled={deleting}
                            className="w-full rounded-lg border border-[var(--border-color)] px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
                        />
                    </div>

                    {error && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={closeModal}
                            disabled={deleting}
                            className="flex-1 rounded-lg border border-[var(--border-color)] px-4 py-3 font-medium disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={!canDelete || deleting}
                            className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {deleting ? 'Deleting…' : 'Delete account'}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    )
}

function RefereeCredentials({ refereeProfile, onUpdate }: { refereeProfile: RefereeProfile; onUpdate: () => void }) {
    const [editingFA, setEditingFA] = useState(false)
    const [faValue, setFaValue] = useState(refereeProfile.fa_id || '')
    const [faError, setFaError] = useState('')
    const [faSaving, setFaSaving] = useState(false)
    const [faSuccess, setFaSuccess] = useState('')

    const dbs = credFromStatus(refereeProfile.dbs_status)
    const safeguarding = credFromStatus(refereeProfile.safeguarding_status)

    async function handleSaveFA() {
        setFaError('')
        setFaSuccess('')
        if (faValue && !/^\d{8,10}$/.test(faValue)) {
            setFaError('Must be 8-10 digits')
            return
        }
        setFaSaving(true)
        const result = await updateFANumber(faValue)
        setFaSaving(false)
        if (result.error) {
            setFaError(result.error)
        } else {
            setEditingFA(false)
            setFaSuccess(faValue ? 'FA number saved — pending verification by admin.' : 'FA number removed.')
            setTimeout(() => setFaSuccess(''), 5000)
            onUpdate()
        }
    }

    return (
        <Card variant="default" padding="md" className="mb-4">
            <SectionTitle icon={ShieldCheck}>Referee Credentials</SectionTitle>

            {/* Credential tiles */}
            <div className="grid grid-cols-2 gap-2">
                <CredTile
                    icon={BadgeCheck}
                    label="Account"
                    value={refereeProfile.verified ? 'Verified' : 'Not verified'}
                    state={refereeProfile.verified ? 'good' : 'neutral'}
                />
                <CredTile icon={ShieldCheck} label="DBS Check" value={dbs.value} state={dbs.state} />
                <CredTile icon={ShieldCheck} label="Safeguarding" value={safeguarding.value} state={safeguarding.state} />
                <CredTile icon={Award} label="Level" value={refereeProfile.level || 'Not set'} state={refereeProfile.level ? 'good' : 'neutral'} />
            </div>

            {/* FA number + status */}
            <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-3">
                    <span className="flex items-center gap-1.5 text-sm">
                        <FileCheck className="h-4 w-4 text-[var(--foreground-muted)]" />
                        FA Number
                    </span>
                    {editingFA ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={faValue}
                                onChange={(e) => setFaValue(e.target.value.replace(/\D/g, ''))}
                                maxLength={10}
                                placeholder="12345678"
                                className="w-28 rounded-md border border-[var(--border-color)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                                autoFocus
                            />
                            <button onClick={handleSaveFA} disabled={faSaving} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50">
                                {faSaving ? '...' : 'Save'}
                            </button>
                            <button
                                onClick={() => { setEditingFA(false); setFaError(''); setFaValue(refereeProfile.fa_id || '') }}
                                className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{refereeProfile.fa_id || 'Not set'}</span>
                            <button onClick={() => setEditingFA(true)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                </div>
                {faError && <p className="-mt-1 text-xs text-red-600">{faError}</p>}
                {faSuccess && (
                    <p className="-mt-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">{faSuccess}</p>
                )}
                {editingFA && refereeProfile.fa_verification_status === 'verified' && (
                    <p className="-mt-1 text-xs text-amber-600">Changing your FA number will reset your verification status.</p>
                )}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--foreground-muted)]">FA Status</span>
                    <FAStatusBadge status={refereeProfile.fa_verification_status} />
                </div>
            </div>
        </Card>
    )
}
