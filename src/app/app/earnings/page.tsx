'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSeasonEarnings, SeasonEarnings } from './actions'
import { ChevronLeft, Banknote, Star, TrendingUp, Calendar } from 'lucide-react'

function EarningsChart({ data }: { data: SeasonEarnings['monthlyBreakdown'] }) {
    const maxEarnings = Math.max(...data.map(d => d.earnings), 1)

    return (
        <div className="card overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--neutral-50)]">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                    Monthly Earnings
                </h2>
            </div>
            <div className="p-4">
                <div className="flex items-end gap-1 h-40">
                    {data.map((item, i) => {
                        const height = maxEarnings > 0 ? (item.earnings / maxEarnings) * 100 : 0
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div className="w-full relative flex flex-col items-center justify-end" style={{ height: '120px' }}>
                                    {item.earnings > 0 && (
                                        <span className="text-[8px] font-bold text-[var(--foreground-muted)] mb-0.5">
                                            &pound;{Math.round(item.earnings)}
                                        </span>
                                    )}
                                    <div
                                        className="w-full max-w-[24px] rounded-t transition-all duration-300"
                                        style={{
                                            height: `${Math.max(height, 2)}%`,
                                            background: item.earnings > 0
                                                ? 'linear-gradient(to top, var(--brand-primary), var(--brand-primary-dark))'
                                                : 'var(--neutral-200)',
                                        }}
                                    />
                                </div>
                                <span className="text-[8px] text-[var(--foreground-muted)] font-medium">
                                    {item.month.split(' ')[0]}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default function EarningsPage() {
    const [earnings, setEarnings] = useState<SeasonEarnings | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            const result = await getSeasonEarnings()
            if (result.error) {
                setError(result.error)
            } else if (result.data) {
                setEarnings(result.data)
            }
            setLoading(false)
        }
        load()
    }, [])

    const now = new Date()
    const seasonStartYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
    const seasonLabel = `${seasonStartYear}/${(seasonStartYear + 1).toString().slice(2)}`

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto pb-24">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Earnings</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Season {seasonLabel}
                    </p>
                </div>
            </div>

            {loading && (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card p-4 animate-pulse">
                            <div className="h-6 bg-[var(--neutral-200)] rounded w-1/3 mb-2" />
                            <div className="h-4 bg-[var(--neutral-200)] rounded w-1/2" />
                        </div>
                    ))}
                </div>
            )}

            {error && !loading && (
                <div className="card p-6 text-center text-sm text-red-500">{error}</div>
            )}

            {earnings && (
                <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="card p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                    <Banknote className="w-4 h-4 text-emerald-600" />
                                </div>
                            </div>
                            <p className="text-2xl font-bold">&pound;{earnings.totalEarnings}</p>
                            <p className="text-[10px] text-[var(--foreground-muted)] uppercase font-medium">Total Earnings</p>
                        </div>

                        <div className="card p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Calendar className="w-4 h-4 text-blue-600" />
                                </div>
                            </div>
                            <p className="text-2xl font-bold">{earnings.totalMatches}</p>
                            <p className="text-[10px] text-[var(--foreground-muted)] uppercase font-medium">Matches</p>
                        </div>

                        <div className="card p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <TrendingUp className="w-4 h-4 text-purple-600" />
                                </div>
                            </div>
                            <p className="text-2xl font-bold">&pound;{earnings.averagePerMatch}</p>
                            <p className="text-[10px] text-[var(--foreground-muted)] uppercase font-medium">Avg Per Match</p>
                        </div>

                        <div className="card p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                    <Star className="w-4 h-4 text-amber-600" />
                                </div>
                            </div>
                            <p className="text-2xl font-bold">
                                {earnings.averageRating > 0 ? earnings.averageRating.toFixed(1) : '—'}
                            </p>
                            <p className="text-[10px] text-[var(--foreground-muted)] uppercase font-medium">Avg Rating</p>
                        </div>
                    </div>

                    {/* Chart */}
                    <EarningsChart data={earnings.monthlyBreakdown} />

                    {/* Empty state if no matches */}
                    {earnings.totalMatches === 0 && (
                        <div className="text-center py-4">
                            <p className="text-sm text-[var(--foreground-muted)]">
                                No completed matches this season yet. Your earnings will appear here once matches are completed.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
