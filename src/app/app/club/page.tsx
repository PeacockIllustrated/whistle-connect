'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { getMyClub, createClub } from './actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ActionCard } from '@/components/app/ActionCard'
import { useToast } from '@/components/ui/Toast'
import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay'
import { ChevronLeft, Shield, Users, MapPin } from 'lucide-react'

export default function ClubPage() {
    const { showToast } = useToast()
    const [isPending, startTransition] = useTransition()
    const [club, setClub] = useState<{ id: string; name: string; home_postcode: string; ground_name: string | null } | null>(null)
    const [loading, setLoading] = useState(true)
    const [celebration, setCelebration] = useState(false)

    // Create form
    const [name, setName] = useState('')
    const [postcode, setPostcode] = useState('')
    const [groundName, setGroundName] = useState('')

    useEffect(() => {
        async function load() {
            const result = await getMyClub()
            if (result.data) setClub(result.data)
            setLoading(false)
        }
        load()
    }, [])

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const result = await createClub(name, postcode, groundName || undefined)
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
            } else {
                setCelebration(true)
                // Reload
                const clubResult = await getMyClub()
                if (clubResult.data) setClub(clubResult.data)
            }
        })
    }

    if (loading) {
        return (
            <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
                <div className="card p-6 animate-pulse">
                    <div className="h-6 bg-[var(--neutral-200)] rounded w-1/3 mb-3" />
                    <div className="h-4 bg-[var(--neutral-200)] rounded w-2/3" />
                </div>
            </div>
        )
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto pb-24">
            {celebration && (
                <CelebrationOverlay
                    icon="party-popper"
                    title="Club Created!"
                    subtitle="Start building your referee pool"
                    onComplete={() => setCelebration(false)}
                />
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">
                        {club ? club.name : 'Create Your Club'}
                    </h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        {club ? 'Manage your club and referee pool' : 'Set up your club to build a trusted referee pool'}
                    </p>
                </div>
                <Shield className="w-5 h-5 text-[var(--brand-primary)]" />
            </div>

            {club ? (
                <div className="space-y-4">
                    {/* Club info */}
                    <div className="card p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-xl bg-[var(--brand-primary)]/10 flex items-center justify-center">
                                <Shield className="w-6 h-6 text-[var(--brand-primary)]" />
                            </div>
                            <div>
                                <h2 className="font-bold">{club.name}</h2>
                                <div className="flex items-center gap-1 text-xs text-[var(--foreground-muted)]">
                                    <MapPin className="w-3 h-3" />
                                    {club.home_postcode}
                                    {club.ground_name && ` - ${club.ground_name}`}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick actions */}
                    <ActionCard
                        href="/app/club/pool"
                        icon={<Users className="w-6 h-6" />}
                        title="Referee Pool"
                        subtitle="Manage your trusted referees"
                        variant="primary"
                    />
                </div>
            ) : (
                <form onSubmit={handleCreate} className="space-y-6">
                    <div className="card p-4 space-y-4">
                        <div>
                            <label className="text-xs font-bold text-[var(--foreground-muted)] uppercase mb-2 block">
                                Club Name *
                            </label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Riverside FC"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[var(--foreground-muted)] uppercase mb-2 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" />
                                Home Postcode *
                            </label>
                            <Input
                                value={postcode}
                                onChange={(e) => setPostcode(e.target.value)}
                                placeholder="e.g. SW1A 1AA"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[var(--foreground-muted)] uppercase mb-2 block">
                                Home Ground
                            </label>
                            <Input
                                value={groundName}
                                onChange={(e) => setGroundName(e.target.value)}
                                placeholder="e.g. Victoria Park Pitch 1"
                            />
                        </div>
                    </div>

                    <Button type="submit" fullWidth size="lg" loading={isPending}>
                        Create Club
                    </Button>
                </form>
            )}
        </div>
    )
}
