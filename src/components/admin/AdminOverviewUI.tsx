import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function fmtNum(n: number): string {
    return n.toLocaleString('en-GB')
}

export function fmtPence(pence: number): string {
    return `£${(pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
}

export function fmtPct(x: number | null): string {
    if (x === null || Number.isNaN(x)) return '—'
    return `${Math.round(x * 100)}%`
}

function fmtDay(date?: string): string {
    if (!date) return ''
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Tone palette — on-brand accents shared by KPI chips and sparklines
// ---------------------------------------------------------------------------

export type Tone = 'brand' | 'sky' | 'green' | 'violet' | 'amber' | 'red'

const TONES: Record<Tone, { chip: string; spark: string }> = {
    brand: { chip: 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]', spark: 'var(--brand-primary)' },
    sky: { chip: 'bg-sky-500/10 text-sky-600', spark: '#0284c7' },
    green: { chip: 'bg-emerald-500/10 text-emerald-600', spark: 'var(--wc-green)' },
    violet: { chip: 'bg-violet-500/10 text-violet-600', spark: '#7c3aed' },
    amber: { chip: 'bg-amber-500/10 text-amber-600', spark: '#d97706' },
    red: { chip: 'bg-red-500/10 text-red-600', spark: 'var(--wc-red)' },
}

// ---------------------------------------------------------------------------
// Sparkline — dependency-free area+line chart with a gradient fill
// ---------------------------------------------------------------------------

// Module counter for stable, unique gradient ids during server render.
let sparkSeq = 0

export function Sparkline({
    data,
    stroke = 'var(--color-primary)',
    className = 'h-8 w-full',
}: {
    data: number[]
    stroke?: string
    className?: string
}) {
    if (!data || data.length === 0) return null
    const w = 100
    const h = 30
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const step = data.length > 1 ? w / (data.length - 1) : w
    const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * h] as const)
    const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    const area = `${line} L${w},${h} L0,${h} Z`
    const gid = `spk${sparkSeq++}`
    return (
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`} />
            <path
                d={line}
                fill="none"
                stroke={stroke}
                strokeWidth={1.75}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    )
}

// ---------------------------------------------------------------------------
// KPI tile — icon chip + big number + optional delta chip + optional sparkline
// ---------------------------------------------------------------------------

export function KpiCard({
    label,
    value,
    icon: Icon,
    tone = 'brand',
    delta,
    deltaLabel,
    series,
}: {
    label: string
    value: string
    icon?: LucideIcon
    tone?: Tone
    /** Signed change vs the previous period. Omit to hide the delta chip. */
    delta?: number
    deltaLabel?: string
    series?: number[]
}) {
    const t = TONES[tone]
    const showDelta = typeof delta === 'number'
    const up = (delta ?? 0) > 0
    const down = (delta ?? 0) < 0
    const DeltaIcon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
    const deltaColor = up
        ? 'text-emerald-600 bg-emerald-50'
        : down
        ? 'text-red-600 bg-red-50'
        : 'text-[var(--foreground-subtle)] bg-[var(--neutral-100)]'

    return (
        <div className="group rounded-2xl border border-[var(--border-color)] bg-[var(--background-elevated)] p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
                {Icon && (
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${t.chip}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                )}
                {showDelta && (
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${deltaColor}`}>
                        <DeltaIcon className="h-3 w-3" />
                        {Math.abs(delta as number)}
                    </span>
                )}
            </div>
            <div className="mt-2.5 text-2xl font-bold tracking-tight text-[var(--foreground)]">{value}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide leading-tight text-[var(--foreground-muted)]">
                {label}
            </div>
            {series && series.length > 1 ? (
                <div className="mt-2">
                    <Sparkline data={series} stroke={t.spark} />
                </div>
            ) : (
                deltaLabel && <p className="mt-1 text-[10px] leading-tight text-[var(--foreground-subtle)]">{deltaLabel}</p>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Bar series — vertical bars (gradient fill) for daily counts
// ---------------------------------------------------------------------------

export function BarSeries({
    data,
    color = 'var(--brand-primary)',
    height = 150,
}: {
    data: { date: string; value: number }[]
    color?: string
    height?: number
}) {
    const max = Math.max(...data.map((d) => d.value), 1)
    const mid = Math.floor(data.length / 2)
    const peak = data.reduce((m, d) => (d.value > m.value ? d : m), data[0] ?? { date: '', value: 0 })
    return (
        <div className="w-full">
            <div className="flex items-end gap-[2px] border-b border-[var(--border-color)]" style={{ height }}>
                {data.map((d) => {
                    const pct = (d.value / max) * 100
                    const isPeak = d.value > 0 && d.value === peak.value
                    return (
                        <div
                            key={d.date}
                            className="flex-1 rounded-t-[3px] transition-opacity hover:opacity-100"
                            style={{
                                height: `${Math.max(pct, 2)}%`,
                                background: `linear-gradient(to top, ${color}, color-mix(in srgb, ${color} 55%, white))`,
                                opacity: d.value === 0 ? 0.12 : isPeak ? 1 : 0.78,
                            }}
                            title={`${fmtDay(d.date)}: ${d.value}`}
                        />
                    )
                })}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-[var(--foreground-subtle)]">
                <span>{fmtDay(data[0]?.date)}</span>
                <span>{fmtDay(data[mid]?.date)}</span>
                <span>{fmtDay(data[data.length - 1]?.date)}</span>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Status breakdown — horizontal stacked bar + legend
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
    draft: 'var(--status-draft)',
    pending: 'var(--status-pending)',
    offered: 'var(--status-offered)',
    confirmed: 'var(--status-confirmed)',
    completed: 'var(--status-completed)',
    cancelled: 'var(--status-cancelled)',
}

export function StatusBreakdown({ data }: { data: { status: string; count: number }[] }) {
    const total = data.reduce((s, d) => s + d.count, 0)
    const segments = data.filter((d) => d.count > 0)
    return (
        <div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--neutral-100)]">
                {total > 0 &&
                    segments.map((d) => (
                        <div
                            key={d.status}
                            style={{ width: `${(d.count / total) * 100}%`, background: STATUS_COLORS[d.status] ?? 'var(--neutral-400)' }}
                            title={`${d.status}: ${d.count}`}
                        />
                    ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                {data.map((d) => (
                    <div key={d.status} className="flex items-center gap-1.5 text-xs">
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: STATUS_COLORS[d.status] ?? 'var(--neutral-400)' }}
                        />
                        <span className="capitalize text-[var(--foreground-muted)]">{d.status}</span>
                        <span className="ml-auto font-semibold tabular-nums text-[var(--foreground)]">{d.count}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Health chip — green/red config status pill
// ---------------------------------------------------------------------------

export function HealthChip({ label, ok }: { label: string; ok: boolean }) {
    return (
        <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
            }`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {label}
        </div>
    )
}
