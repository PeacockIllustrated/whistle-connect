import { RefereeSearchResult } from '@/lib/types'
import { StatusChip } from '@/components/ui/StatusChip'

interface RefereeSearchResultCardProps {
    referee: RefereeSearchResult
    onBook: (referee: RefereeSearchResult) => void
    onViewProfile: (referee: RefereeSearchResult) => void
}

export function RefereeSearchResultCard({
    referee,
    onBook,
    onViewProfile,
}: RefereeSearchResultCardProps) {
    return (
        <div className="bg-white border border-[var(--border-color)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-[var(--neutral-100)] flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {referee.avatar_url ? (
                        <img src={referee.avatar_url} alt={referee.full_name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-[var(--neutral-400)] font-semibold text-lg">
                            {referee.full_name[0]}
                        </span>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                        <h3 className="font-semibold text-[var(--foreground)] truncate">
                            {referee.full_name}
                        </h3>
                        {referee.verified && (
                            <span className="flex items-center text-[var(--color-primary)]">
                                <svg className="w-4 h-4 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-[10px] uppercase font-bold tracking-tight">Verified</span>
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center text-sm text-[var(--foreground-muted)] mb-3">
                        {referee.level && (
                            <span className="bg-[var(--neutral-100)] px-2 py-0.5 rounded text-xs font-medium">
                                Level {referee.level}
                            </span>
                        )}
                        {referee.county && (
                            <span>- {referee.county}</span>
                        )}
                        {referee.travel_radius_km > 0 && (
                            <span>- {referee.travel_radius_km}km radius</span>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <StatusChip status={referee.dbs_status === 'verified' ? 'verified' : 'pending'} />
                        <StatusChip status={referee.safeguarding_status === 'verified' ? 'verified' : 'pending'} />
                    </div>
                </div>
            </div>

            <div className="mt-4 flex gap-2">
                <button
                    onClick={() => onViewProfile(referee)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-[var(--foreground)] bg-white border border-[var(--border-color)] rounded-lg hover:bg-[var(--neutral-50)] transition-colors"
                >
                    View Profile
                </button>
                <button
                    onClick={() => onBook(referee)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90 transition-colors"
                >
                    Request
                </button>
            </div>
        </div>
    )
}
