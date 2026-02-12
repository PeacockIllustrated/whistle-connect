'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { StatusChip } from '@/components/ui/StatusChip'
import { ProfileEditForm } from './ProfileEditForm'
import { AvatarUpload } from '@/components/profile/AvatarUpload'
import { PrivacyToggleRow } from '@/components/profile/PrivacyToggleRow'
import { CheckCircle } from 'lucide-react'
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
                <Card variant="default" padding="md" className="mb-4">
                    <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-4">
                        Referee Details
                    </h2>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                            <span className="text-sm">FA Number</span>
                            <span className="text-sm font-medium">{refereeProfile.fa_id || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
                            <span className="text-sm">FA Verified</span>
                            {refereeProfile.verified ? (
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
                        <div className="flex justify-between items-center py-2">
                            <span className="text-sm">Level</span>
                            <span className="text-sm font-medium">{refereeProfile.level || 'Not set'}</span>
                        </div>
                    </div>
                </Card>
            )}
        </>
    )
}
