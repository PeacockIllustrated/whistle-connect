import Link from 'next/link'
import { Trophy, ChevronRight, Check } from 'lucide-react'
import type { Achievements, AchTier, AchTrack } from '@/lib/achievements'
import { badgeIcon, TIER_GRAD, TIER_GLOW } from './tiers'

function Ring({ frac, color }: { frac: number; color: string }) {
    const size = 40, sw = 4, r = (size - sw) / 2, C = 2 * Math.PI * r
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--neutral-200)" strokeWidth={sw} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
    )
}

function highestEarnedTier(track: AchTrack): AchTier | null {
    let tier: AchTier | null = null
    track.nodes.forEach((n) => { if (n.state === 'earned') tier = n.tier })
    return tier
}

/**
 * Compact achievements preview for the account page. Summarises tiers earned +
 * the next badge, shows a few earned medallions, and links to the full page.
 */
export function AchievementsHighlight({ data }: { data: Achievements }) {
    if (!data.tracks.length) return null

    const medallions = data.tracks
        .map((t) => ({ icon: t.icon, tier: highestEarnedTier(t) }))
        .filter((m) => m.tier)
        .slice(0, 4)

    return (
        <Link
            href="/app/achievements"
            className="group mb-4 block rounded-2xl border border-[var(--border-color)] bg-[var(--background-elevated)] p-4 shadow-sm transition-colors hover:border-[var(--color-primary)]"
        >
            <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-[var(--brand-primary)]" />
                <Trophy className="h-4 w-4 text-[var(--foreground-muted)]" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Achievements</h2>
                <span className="rounded-full bg-[var(--brand-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--brand-primary)]">Lv {data.level}</span>
                <ChevronRight className="ml-auto h-4 w-4 text-[var(--neutral-400)] transition-transform group-hover:translate-x-0.5" />
            </div>

            <div className="mt-3 flex items-center gap-4">
                <div>
                    <div className="text-2xl font-bold leading-none">{data.totalTiersEarned}</div>
                    <div className="text-[11px] text-[var(--foreground-muted)]">tiers · {data.totalXp.toLocaleString('en-GB')} XP</div>
                </div>

                {/* earned medallions */}
                <div className="flex -space-x-2">
                    {medallions.map((m, i) => (
                        <div key={i} className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-sm" style={{ background: TIER_GRAD[m.tier as AchTier] }}>
                            {badgeIcon(m.icon, { className: 'h-4 w-4 text-white' })}
                        </div>
                    ))}
                    {medallions.length === 0 && <span className="text-[11px] text-[var(--foreground-subtle)]">None yet — keep going!</span>}
                </div>

                {/* next */}
                {data.next && (
                    <div className="ml-auto flex items-center gap-2.5 text-right">
                        <div className="min-w-0">
                            <div className="text-[11px] font-semibold leading-tight">{data.next.nodeName}</div>
                            <div className="flex items-center justify-end gap-1 text-[10px] text-[var(--foreground-subtle)]">
                                <Check className="h-2.5 w-2.5" /> {data.next.value}/{data.next.req}
                            </div>
                        </div>
                        <Ring frac={data.next.frac} color={TIER_GLOW[data.next.tier]} />
                    </div>
                )}
            </div>
        </Link>
    )
}
