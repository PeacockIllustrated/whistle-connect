import { Star, Shield, Trophy } from 'lucide-react'

interface ReliabilityBadgeProps {
    score: number
    matchCount: number
    averageRating: number
    compact?: boolean
}

export function ReliabilityBadge({ score, matchCount, averageRating, compact = false }: ReliabilityBadgeProps) {
    const getColor = () => {
        if (score >= 70) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-500' }
        if (score >= 50) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'text-amber-500' }
        return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: 'text-red-500' }
    }

    const colors = getColor()

    if (matchCount === 0) {
        if (compact) return null
        return (
            <span className="text-[10px] text-[var(--foreground-muted)] italic">New referee</span>
        )
    }

    if (compact) {
        return (
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${colors.bg} ${colors.border} border`}>
                <Shield className={`w-3 h-3 ${colors.icon}`} />
                <span className={`text-[10px] font-bold ${colors.text}`}>{Math.round(score)}%</span>
            </div>
        )
    }

    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl ${colors.bg} ${colors.border} border`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.bg}`}>
                {score >= 70 ? (
                    <Trophy className={`w-5 h-5 ${colors.icon}`} />
                ) : (
                    <Shield className={`w-5 h-5 ${colors.icon}`} />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${colors.text}`}>{Math.round(score)}%</span>
                    <span className="text-[10px] text-[var(--foreground-muted)]">reliability</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                    {averageRating > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--foreground-muted)]">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {averageRating.toFixed(1)}
                        </span>
                    )}
                    <span className="text-[10px] text-[var(--foreground-muted)]">
                        {matchCount} match{matchCount !== 1 ? 'es' : ''}
                    </span>
                </div>
            </div>
        </div>
    )
}
