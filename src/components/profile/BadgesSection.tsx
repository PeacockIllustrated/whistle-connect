import { Card } from '@/components/ui/Card'
import type { UserBadge, BadgeTier } from '@/lib/badges'
import {
    PartyPopper,
    CheckCircle2,
    BadgeCheck,
    CalendarCheck,
    Flag,
    Medal,
    ShieldCheck,
    Trophy,
    Award,
    Lock,
    type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
    PartyPopper,
    CheckCircle2,
    BadgeCheck,
    CalendarCheck,
    Flag,
    Medal,
    ShieldCheck,
    Trophy,
}

const TIER_STYLE: Record<BadgeTier, { chip: string; label: string }> = {
    bronze: { chip: 'bg-amber-100 text-amber-700', label: 'Bronze' },
    silver: { chip: 'bg-slate-200 text-slate-600', label: 'Silver' },
    gold: { chip: 'bg-yellow-100 text-yellow-700', label: 'Gold' },
}

export function BadgesSection({ badges }: { badges: UserBadge[] }) {
    if (!badges || badges.length === 0) return null
    const earnedCount = badges.filter((b) => b.earned).length

    return (
        <Card variant="default" padding="md" className="mb-4">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-[var(--brand-primary)]" />
                    <Award className="h-4 w-4 text-[var(--foreground-muted)]" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Achievements</h2>
                </div>
                <span className="text-xs font-medium text-[var(--foreground-muted)]">
                    {earnedCount} of {badges.length}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {badges.map((b) => {
                    const Icon = ICONS[b.icon] ?? Award
                    const tier = TIER_STYLE[b.tier]
                    return (
                        <div key={b.code} className="flex flex-col items-center gap-1.5 text-center" title={b.description}>
                            <div
                                className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${
                                    b.earned ? tier.chip : 'bg-[var(--neutral-100)] text-[var(--neutral-300)]'
                                }`}
                            >
                                <Icon className="h-6 w-6" />
                                {!b.earned && (
                                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--background-elevated)]">
                                        <Lock className="h-2.5 w-2.5 text-[var(--foreground-subtle)]" />
                                    </span>
                                )}
                            </div>
                            <div className={`text-[11px] font-semibold leading-tight ${b.earned ? 'text-[var(--foreground)]' : 'text-[var(--foreground-muted)]'}`}>
                                {b.name}
                            </div>
                            <div className="text-[10px] leading-tight text-[var(--foreground-subtle)]">
                                {b.earned ? tier.label : 'Locked'}
                            </div>
                        </div>
                    )
                })}
            </div>
        </Card>
    )
}
