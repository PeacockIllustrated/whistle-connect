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

/** A small collection coin — minted (earned) or embossed/un-minted (locked). */
function Coin({ icon, tier }: { icon: string; tier: AchTier | null }) {
    if (!tier) {
        return (
            <div
                className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white"
                style={{
                    background: 'linear-gradient(160deg,#f4f7fb,#e2e8f1)',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.9), inset 0 -2px 4px rgba(148,163,184,0.35)',
                }}
            >
                {badgeIcon(icon, { className: 'h-4 w-4', color: '#aeb8c5' })}
            </div>
        )
    }
    return (
        <div
            className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white"
            style={{ background: TIER_GRAD[tier], boxShadow: `0 3px 8px -2px ${TIER_GLOW[tier]}aa` }}
        >
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ background: 'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.6), rgba(255,255,255,0) 55%)' }}
            />
            {badgeIcon(icon, { className: 'relative h-4 w-4 text-white' })}
        </div>
    )
}

/**
 * Compact achievements preview for the account page. Shows level + XP progress,
 * a coin for every track (minted when earned, embossed when not), the next
 * badge, and links to the full page.
 */
export function AchievementsHighlight({ data }: { data: Achievements }) {
    if (!data.tracks.length) return null

    const xpPct = Math.round((data.xpIntoLevel / data.xpPerLevel) * 100)

    return (
        <Link
            href="/app/achievements"
            className="group mb-4 block rounded-2xl border border-[var(--border-color)] bg-[var(--background-elevated)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-md"
        >
            <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-[var(--brand-primary)]" />
                <Trophy className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">Achievements</h2>
                <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
                    style={{ background: 'linear-gradient(90deg,var(--wc-blue),var(--brand-primary))' }}
                >
                    Lv {data.level}
                </span>
                <ChevronRight className="ml-auto h-4 w-4 text-[var(--neutral-400)] transition-transform group-hover:translate-x-0.5" />
            </div>

            <div className="mt-3 flex items-center gap-4">
                <div className="shrink-0">
                    <div className="text-2xl font-bold leading-none">{data.totalTiersEarned}</div>
                    <div className="text-[11px] text-[var(--foreground-muted)]">tiers earned</div>
                </div>

                {/* collection — a coin per track */}
                <div className="flex -space-x-2.5">
                    {data.tracks.slice(0, 4).map((t, i) => (
                        <Coin key={i} icon={t.icon} tier={highestEarnedTier(t)} />
                    ))}
                </div>

                {/* next badge */}
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

            {/* level / XP progress */}
            <div className="mt-3.5">
                <div className="mb-1 flex items-center justify-between text-[10px]">
                    <span className="font-bold text-[var(--foreground-muted)]">{data.totalXp.toLocaleString('en-GB')} XP</span>
                    <span className="text-[var(--foreground-subtle)]">{data.xpIntoLevel} / {data.xpPerLevel} to Level {data.level + 1}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--neutral-200)]">
                    <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${xpPct}%`, background: 'linear-gradient(90deg,var(--wc-blue),var(--brand-primary))' }}
                    />
                </div>
            </div>
        </Link>
    )
}
