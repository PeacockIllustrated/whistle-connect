'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getClubPool, removeRefereeFromPool } from '../actions'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ChevronLeft, Users, UserMinus } from 'lucide-react'

interface PoolMember {
    id: string
    status: string
    added_at: string
    referee: { id: string; full_name: string; avatar_url: string | null }
        | { id: string; full_name: string; avatar_url: string | null }[]
}

export default function PoolPage() {
    const { showToast } = useToast()
    const [pool, setPool] = useState<PoolMember[]>([])
    const [loading, setLoading] = useState(true)
    const [removingId, setRemovingId] = useState<string | null>(null)
    const [, startTransition] = useTransition()

    useEffect(() => {
        async function load() {
            const result = await getClubPool()
            if (result.data) setPool(result.data as PoolMember[])
            if (result.error) showToast({ message: result.error, type: 'error' })
            setLoading(false)
        }
        load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleRemove = (refereeId: string) => {
        setRemovingId(refereeId)
        startTransition(async () => {
            const result = await removeRefereeFromPool(refereeId)
            if (result.error) {
                showToast({ message: result.error, type: 'error' })
            } else {
                setPool(prev => prev.filter(p => {
                    const ref = Array.isArray(p.referee) ? p.referee[0] : p.referee
                    return ref.id !== refereeId
                }))
                showToast({ message: 'Referee removed from pool', type: 'success' })
            }
            setRemovingId(null)
        })
    }

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto pb-24">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app/club" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Referee Pool</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        {pool.length} trusted referee{pool.length !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>

            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card p-4 animate-pulse flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[var(--neutral-200)]" />
                            <div className="flex-1">
                                <div className="h-4 bg-[var(--neutral-200)] rounded w-1/3 mb-1" />
                                <div className="h-3 bg-[var(--neutral-200)] rounded w-1/4" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && pool.length === 0 && (
                <div className="card p-8 text-center">
                    <Users className="w-12 h-12 mx-auto mb-3 text-[var(--neutral-300)]" />
                    <h2 className="font-semibold text-sm mb-1">No referees in your pool</h2>
                    <p className="text-xs text-[var(--foreground-muted)]">
                        After booking referees, you can add them to your trusted pool for priority access on future matches.
                    </p>
                </div>
            )}

            {!loading && pool.length > 0 && (
                <div className="space-y-2">
                    {pool.map(member => {
                        const referee = Array.isArray(member.referee) ? member.referee[0] : member.referee
                        return (
                            <div key={member.id} className="card p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--neutral-100)] flex-shrink-0 flex items-center justify-center overflow-hidden">
                                    {referee.avatar_url ? (
                                        <Image src={referee.avatar_url} alt={referee.full_name} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                                    ) : (
                                        <span className="text-[var(--neutral-400)] font-semibold">
                                            {referee.full_name[0]}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate">{referee.full_name}</p>
                                    <p className="text-[10px] text-[var(--foreground-muted)]">
                                        Added {new Date(member.added_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemove(referee.id)}
                                    loading={removingId === referee.id}
                                >
                                    <UserMinus className="w-4 h-4" />
                                </Button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
