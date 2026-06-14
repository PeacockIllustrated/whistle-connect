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
// Sparkline — tiny dependency-free area+line chart for KPI tiles
// ---------------------------------------------------------------------------

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
    return (
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
            <path d={area} fill={stroke} opacity={0.1} />
            <path
                d={line}
                fill="none"
                stroke={stroke}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    )
}

// ---------------------------------------------------------------------------
// KPI tile — big number + optional delta chip + optional sparkline
// ---------------------------------------------------------------------------

export function KpiCard({
    label,
    value,
    icon: Icon,
    delta,
    deltaLabel,
    series,
    accent = 'var(--color-primary)',
}: {
    label: string
    value: string
    icon?: LucideIcon
    /** Signed change vs the previous period. Omit to hide the delta chip. */
    delta?: number
    deltaLabel?: string
    series?: number[]
    accent?: string
}) {
    const showDelta = typeof delta === 'number'
    const up = (delta ?? 0) > 0
    const down = (delta ?? 0) < 0
    const DeltaIcon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
    const deltaColor = up ? 'text-emerald-600' : down ? 'text-red-600' : 'text-[var(--foreground-subtle)]'

    return (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--background-elevated)] p-3.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-[var(--foreground-muted)]">
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span className="text-[11px] font-medium uppercase tracking-wide leading-tight">{label}</span>
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-2">
                <span className="text-2xl font-bold tracking-tight text-[var(--foreground)]">{value}</span>
                {showDelta && (
                    <span className={`mb-0.5 inline-flex items-center gap-0.5 text-xs font-semibold ${deltaColor}`}>
                        <DeltaIcon className="h-3.5 w-3.5" />
                        {Math.abs(delta as number)}
                    </span>
                )}
            </div>
            {series && series.length > 1 ? (
                <div className="mt-2">
                    <Sparkline data={series} stroke={accent} />
                </div>
            ) : (
                deltaLabel && (
                    <p className="mt-1 text-[10px] text-[var(--foreground-subtle)]">{deltaLabel}</p>
                )
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Bar series — vertical bars for daily counts
// ---------------------------------------------------------------------------

export function BarSeries({
    data,
    color = 'var(--color-primary)',
    height = 150,
}: {
    data: { date: string; value: number }[]
    color?: string
    height?: number
}) {
    const max = Math.max(...data.map((d) => d.value), 1)
    const mid = Math.floor(data.length / 2)
    return (
        <div className="w-full">
            <div className="flex items-end gap-[2px]" style={{ height }}>
                {data.map((d) => {
                    const pct = (d.value / max) * 100
                    return (
                        <div
                            key={d.date}
                            className="flex-1 rounded-t-[3px] transition-all"
                            style={{
                                height: `${Math.max(pct, 2)}%`,
                                background: color,
                                opacity: d.value === 0 ? 0.15 : 0.85,
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
                        <span className="ml-auto font-semibold text-[var(--foreground)] tabular-nums">{d.count}</span>
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
                ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
            }`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {label}
        </div>
    )
}
