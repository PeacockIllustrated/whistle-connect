import { Check, Lock, Trophy } from 'lucide-react'
import type { Achievements, AchTrack, AchTier } from '@/lib/achievements'
import { badgeIcon, TIER_NAME, TIER_GRAD, TIER_GLOW, TIER_PILL, railFill } from './tiers'
import { MilestonesShowcase } from './MilestonesShowcase'

function Ring({ frac, color, size = 46, sw = 4 }: { frac: number; color: string; size?: number; sw?: number }) {
    const r = (size - sw) / 2
    const C = 2 * Math.PI * r
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eaeef3" strokeWidth={sw} />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
        </svg>
    )
}

function highestEarned(track: AchTrack): number {
    let li = -1
    track.nodes.forEach((n, i) => { if (n.state === 'earned') li = i })
    return li
}

// ── Collection honeycomb ─────────────────────────────────────────────────────
function Collection({ tracks }: { tracks: AchTrack[] }) {
    type Cell = { icon: string; name: string; tier: AchTier | null; locked: boolean }
    const cells: Cell[] = []
    for (const t of tracks) {
        const li = highestEarned(t)
        if (li < 0) cells.push({ icon: t.icon, name: t.nodes[0].name, tier: null, locked: true })
        else cells.push({ icon: t.icon, name: t.nodes[li].name, tier: t.nodes[li].tier, locked: false })
    }
    for (const t of tracks) {
        const cur = t.nodes.find((n) => n.state === 'current')
        if (cur && cur.tier !== 'bronze') cells.push({ icon: t.icon, name: cur.name, tier: cur.tier, locked: true })
    }
    const rows: Cell[][] = [[], [], []]
    cells.slice(0, 9).forEach((c, i) => rows[Math.floor(i / 3)].push(c))

    return (
        <div className="wc-rise flex flex-col items-center gap-1 rounded-2xl border border-[var(--border-color)] bg-[var(--background-elevated)] p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
            {rows.filter((r) => r.length).map((row, ri) => (
                <div key={ri} className="flex gap-1.5" style={ri % 2 ? { marginLeft: 42 } : undefined}>
                    {row.map((c, i) => {
                        return (
                            <div key={i} className="w-[78px] text-center">
                                <div className="relative mx-auto h-[86px] w-[78px]">
                                    <div
                                        className="absolute inset-0 flex items-center justify-center"
                                        style={{ clipPath: 'polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)', background: c.locked ? '#eef2f6' : TIER_GRAD[c.tier as AchTier] }}
                                    >
                                        {c.locked
                                            ? <Lock className="h-7 w-7" color="#b6c0cd" strokeWidth={2} />
                                            : badgeIcon(c.icon, { className: 'h-7 w-7', color: '#ffffff', strokeWidth: 2 })}
                                    </div>
                                    {!c.locked && (
                                        <span className="absolute bottom-4 right-1.5 flex h-[17px] w-[17px] items-center justify-center rounded-full bg-white shadow">
                                            <Check className="h-2.5 w-2.5 text-emerald-600" strokeWidth={3.2} />
                                        </span>
                                    )}
                                </div>
                                <div className={`mt-1 text-[10px] font-bold leading-tight ${c.locked ? 'text-[var(--foreground-muted)]' : ''}`}>{c.name}</div>
                                <div className="text-[8.5px] uppercase tracking-wide text-[var(--foreground-subtle)]">
                                    {c.locked ? 'Locked' : TIER_NAME[c.tier as AchTier]}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}

// ── Progression rail card ────────────────────────────────────────────────────
function TrackCard({ track, index }: { track: AchTrack; index: number }) {
    const n = track.nodes.length
    const li = highestEarned(track)
    const fill = railFill(track.nodes)
    const current = track.nodes.find((nd) => nd.state === 'current')
    const caption = !current
        ? <><b className="text-[var(--foreground)]">Maxed out</b> — Platinum achieved</>
        : <><b className="text-[var(--foreground)]">{current.req - track.value}</b> to go for <b className="text-[var(--foreground)]">{current.name}</b> ({TIER_NAME[current.tier]})</>

    return (
        <div
            className="wc-rise mb-3 rounded-2xl border border-[var(--border-color)] bg-[var(--background-elevated)] p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ animationDelay: `${index * 70}ms` }}
        >
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]" style={{ background: 'linear-gradient(160deg,#eef2f8,#e1e7f0)' }}>
                    {badgeIcon(track.icon, { className: 'h-5 w-5 text-[var(--brand-primary)]' })}
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--foreground-subtle)]">{track.role}</div>
                    <div className="text-sm font-bold">{track.name}</div>
                </div>
                <span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${li >= 0 ? TIER_PILL[track.nodes[li].tier] : 'bg-[var(--neutral-100)] text-[var(--foreground-muted)]'}`}>
                    {li >= 0 ? TIER_NAME[track.nodes[li].tier] : 'Locked'}
                </span>
            </div>

            {/* rail */}
            <div className="relative mt-3 h-14">
                <div className="absolute left-[19px] right-[19px] top-[21px] h-[5px] rounded-full bg-[#eaeef3]" />
                <div className="absolute left-[19px] top-[21px] h-[5px] rounded-full" style={{ width: `calc((100% - 38px) * ${fill})`, background: 'linear-gradient(90deg,var(--wc-blue),#46578a)' }} />
                {track.nodes.map((nd, i) => {
                    const pos = (i / (n - 1)) * 100
                    const underLabel = track.unit ? nd.name.split(' ')[0] : nd.state === 'current' ? `${track.value}/${nd.req}` : String(nd.req)
                    return (
                        <div key={i} className="absolute top-[21px] -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos}%` }}>
                            <div className="relative inline-block">
                                {nd.state === 'earned' && (
                                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white shadow" style={{ background: TIER_GRAD[nd.tier] }}>
                                        <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.6} />
                                    </div>
                                )}
                                {nd.state === 'current' && (
                                    <>
                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><Ring frac={nd.frac} color={TIER_GLOW[nd.tier]} /></div>
                                        <div className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 border-white bg-white shadow-md">
                                            {badgeIcon(track.icon, { className: 'h-4 w-4', color: TIER_GLOW[nd.tier] })}
                                        </div>
                                    </>
                                )}
                                {nd.state === 'locked' && (
                                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white bg-[#eef2f6]">
                                        <Lock className="h-3.5 w-3.5" color="#b6c0cd" />
                                    </div>
                                )}
                            </div>
                            <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[9.5px] font-bold text-[var(--foreground-muted)] ${nd.state === 'current' ? 'top-[30px]' : 'top-[26px]'}`}>{underLabel}</span>
                        </div>
                    )
                })}
            </div>

            <p className="mt-3.5 text-[11px] text-[var(--foreground-muted)]">{caption}</p>
        </div>
    )
}

export function AchievementsView({ data }: { data: Achievements }) {
    if (!data.tracks.length) {
        return (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--background-elevated)] p-8 text-center">
                <Trophy className="mx-auto h-8 w-8 text-[var(--foreground-subtle)]" />
                <p className="mt-3 text-sm text-[var(--foreground-muted)]">Achievements unlock as you use Whistle Connect.</p>
            </div>
        )
    }

    const next = data.next

    return (
        <div className="space-y-1">
            {/* Summary */}
            <div className="wc-sheen relative overflow-hidden rounded-2xl p-[18px] text-white shadow-lg" style={{ background: 'linear-gradient(135deg,var(--wc-blue),var(--brand-primary-dark) 75%,#10162a)' }}>
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--wc-red)]/25 blur-3xl" />
                <div className="relative text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/55">Your achievements</div>
                <div className="relative mt-1.5 flex items-end justify-between gap-3">
                    <div className="text-[30px] font-extrabold leading-none">
                        {data.totalTiersEarned}<span className="text-sm font-semibold text-white/70"> tiers earned</span>
                    </div>
                    <div className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">Level {data.level}</div>
                </div>
                <div className="relative mt-3">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-white/70">
                        <span className="font-semibold text-white/90">{data.totalXp.toLocaleString('en-GB')} XP</span>
                        <span>{data.xpIntoLevel} / {data.xpPerLevel} to Level {data.level + 1}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                        <div className="h-full rounded-full bg-[var(--wc-green)]" style={{ width: `${(data.xpIntoLevel / data.xpPerLevel) * 100}%` }} />
                    </div>
                </div>
                {next && (
                    <div className="relative mt-3.5 flex items-center gap-2.5 rounded-[13px] border border-white/15 bg-white/10 px-3 py-2.5">
                        <div className="min-w-0">
                            <div className="text-[12.5px] font-bold">Next: {next.nodeName}</div>
                            <div className="text-[11px] text-white/70">{next.value} / {next.req} · {next.trackName.toLowerCase()}</div>
                        </div>
                        <div className="ml-auto shrink-0"><Ring frac={next.frac} color={TIER_GLOW[next.tier]} size={38} /></div>
                    </div>
                )}
            </div>

            {/* Collection */}
            <div className="flex items-center gap-2 pt-6 pb-3">
                <span className="h-4 w-1 rounded-full bg-[var(--wc-red)]" />
                <h2 className="text-sm font-bold">Your collection</h2>
            </div>
            <Collection tracks={data.tracks} />

            {/* Milestones */}
            <MilestonesShowcase items={data.milestones} />

            {/* Progression */}
            <div className="flex items-center gap-2 pt-6 pb-3">
                <span className="h-4 w-1 rounded-full bg-[var(--wc-red)]" />
                <h2 className="text-sm font-bold">Progression</h2>
            </div>
            {data.tracks.map((t, i) => <TrackCard key={t.key} track={t} index={i} />)}
        </div>
    )
}
