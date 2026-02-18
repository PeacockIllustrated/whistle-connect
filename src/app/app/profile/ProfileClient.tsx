'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { StatusChip } from '@/components/ui/StatusChip'
import { FAStatusBadge } from '@/components/ui/FAStatusBadge'
import { ProfileEditForm } from './ProfileEditForm'
import { AvatarUpload } from '@/components/profile/AvatarUpload'
import { PrivacyToggleRow } from '@/components/profile/PrivacyToggleRow'
import { updateFANumber } from './actions'
import { Pencil } from 'lucide-react'
import Image from 'next/image'
import type { Profile, RefereeProfile } from '@/lib/types'

interface ProfileClientProps {
    user: { id: string; email?: string }
    profile: Profile
    refereeProfile: RefereeProfile | null
}

export function ProfileClient({ user, profile: initialProfile, refereeProfile }: ProfileClientProps) {
    const router = useRouter()
    const [isEditing, setIsEditing] = useState(false)
    const [profile, setProfile] = useState(initialProfile)

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
                            phone: profile.phone || ''
                        }}
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
            {/* Profile Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] flex items-center justify-center text-white text-2xl font-bold shadow-lg overflow-hidden">
                    {profile?.avatar_url ? (
                        <Image src={profile.avatar_url} alt={profile.full_name} width={64} height={64} className="w-full h-full object-cover" unoptimized />
                    ) : (
                        profile?.full_name?.charAt(0) || '?'
                    )}
                </div>
                <div className="flex-1">
                    <h1 className="text-xl font-bold">{profile?.full_name}</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">{user.email}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    {profile?.role && (
                        <StatusChip status={profile.role} size="md" />
                    )}
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-3 py-1.5 rounded-full hover:bg-[var(--color-primary)]/20 transition-colors"
                    >
                        Edit Profile
                    </button>
                </div>
            </div>

            {/* Profile Info */}
            <Card variant="default" padding="md" className="mb-4">
                <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-4">
                    Account Details
                </h2>
                <div className="space-y-1">
                    <PrivacyToggleRow label="Phone" value={profile?.phone} />
                    <PrivacyToggleRow label="Postcode" value={profile?.postcode} />
                    <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-[var(--foreground-muted)]">Member Since</span>
                        <span className="text-sm font-medium">
                            {profile?.created_at
                                ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                                : '-'
                            }
                        </span>
                    </div>
                </div>
            </Card>

            {/* Referee Details (if referee) */}
            {profile?.role === 'referee' && refereeProfile && (
                <RefereeDetailsCard refereeProfile={refereeProfile} onUpdate={() => router.refresh()} />
            )}
        </>
    )
}

function RefereeDetailsCard({ refereeProfile, onUpdate }: { refereeProfile: RefereeProfile; onUpdate: () => void }) {
    const [editingFA, setEditingFA] = useState(false)
    const [faValue, setFaValue] = useState(refereeProfile.fa_id || '')
    const [faError, setFaError] = useState('')
    const [faSaving, setFaSaving] = useState(false)
    const [faSuccess, setFaSuccess] = useState('')

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
            <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-4">
                Referee Details
            </h2>
            <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                    <span className="text-sm">FA Number</span>
                    {editingFA ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={faValue}
                                onChange={(e) => setFaValue(e.target.value.replace(/\D/g, ''))}
                                maxLength={10}
                                placeholder="12345678"
                                className="w-28 px-2 py-1 text-sm border border-[var(--border-color)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
                                autoFocus
                            />
                            <button
                                onClick={handleSaveFA}
                                disabled={faSaving}
                                className="text-xs font-semibold text-green-700 hover:text-green-800 disabled:opacity-50"
                            >
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
                            <button
                                onClick={() => setEditingFA(true)}
                                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
                {faError && (
                    <p className="text-xs text-red-600 -mt-1">{faError}</p>
                )}
                {faSuccess && (
                    <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-1.5 -mt-1">{faSuccess}</p>
                )}
                {editingFA && refereeProfile.fa_verification_status === 'verified' && (
                    <p className="text-xs text-amber-600 -mt-1">Changing your FA number will reset your verification status.</p>
                )}
                <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                    <span className="text-sm">FA Status</span>
                    <FAStatusBadge status={refereeProfile.fa_verification_status} />
                </div>
                <div className="flex justify-between items-center py-2">
                    <span className="text-sm">Level</span>
                    <span className="text-sm font-medium">{refereeProfile.level || 'Not set'}</span>
                </div>
            </div>
        </Card>
    )
}
