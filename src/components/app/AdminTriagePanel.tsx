import Link from 'next/link'
import type { AdminTriage } from '@/app/app/admin/actions'
import {
    FileCheck,
    AlertOctagon,
    Banknote,
    ArrowDownToLine,
    ShieldAlert,
    Webhook,
    CheckCircle2,
    type LucideIcon,
} from 'lucide-react'

interface TriageTile {
    key: string
    label: string
    count: number
    detail?: string
    href: string
    icon: LucideIcon
    tone: 'green' | 'amber' | 'red' | 'neutral'
}

function ageLabel(hours: number | null): string | undefined {
    if (hours === null) return undefined
    if (hours < 1) return 'oldest <1h'
    if (hours < 48) return `oldest ${hours}h`
    const days = Math.floor(hours / 24)
    return `oldest ${days}d`
}

function buildTiles(triage: AdminTriage): TriageTile[] {
    const fa = triage.pendingFAVerifications
    const disputes = triage.openDisputes
    const escrow = triage.stuckEscrow
    const withdrawals = triage.failedOrPendingWithdrawals
    const dbs = triage.dbsExpiringSoon
    const webhooks = triage.webhookFailures24h

    return [
        {
            key: 'fa',
            label: 'Pending FA verifications',
            count: fa.count,
            detail: fa.count > 0 ? ageLabel(fa.oldestAgeHours) : undefined,
            href: '/app/admin/verification',
            icon: FileCheck,
            tone: fa.count === 0 ? 'green' : fa.count > 5 || (fa.oldestAgeHours ?? 0) > 72 ? 'red' : 'amber',
        },
        {
            key: 'disputes',
            label: 'Open disputes',
            count: disputes.count,
            detail: disputes.count > 0 ? ageLabel(disputes.oldestAgeHours) : undefined,
            href: '/app/disputes',
            icon: AlertOctagon,
            tone: disputes.count === 0 ? 'green' : 'red',
        },
        {
            key: 'escrow',
            label: 'Stuck escrow (>7d)',
            count: escrow.count,
            href: '/app/admin/triage/escrow',
            icon: Banknote,
            tone: escrow.count === 0 ? 'green' : 'red',
        },
        {
            key: 'withdrawals',
            label: 'Withdrawals stuck',
            count: withdrawals.count,
            href: '/app/admin/triage/withdrawals',
            icon: ArrowDownToLine,
            tone: withdrawals.count === 0 ? 'green' : 'red',
        },
        {
            key: 'dbs',
            label: 'DBS expiring (30d)',
            count: dbs.count,
            href: '/app/admin/referees?filter=dbs-expiring',
            icon: ShieldAlert,
            tone: dbs.count === 0 ? 'green' : 'amber',
        },
        {
            key: 'webhooks',
            label: 'Webhook failures (24h)',
            count: webhooks.count,
            href: '/app/admin/triage/webhooks',
            icon: Webhook,
            tone: webhooks.count === 0 ? 'green' : 'red',
        },
    ]
}

const toneClasses: Record<TriageTile['tone'], { card: string; icon: string; count: string }> = {
    green: {
        card: 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50',
        icon: 'text-emerald-600',
        count: 'text-emerald-700',
    },
    amber: {
        card: 'border-amber-200 bg-amber-50/40 hover:bg-amber-50',
        icon: 'text-amber-600',
        count: 'text-amber-700',
    },
    red: {
        card: 'border-red-200 bg-red-50/40 hover:bg-red-50',
        icon: 'text-red-600',
        count: 'text-red-700',
    },
    neutral: {
        card: 'border-[var(--border-color)] bg-white hover:bg-[var(--neutral-50)]',
        icon: 'text-[var(--foreground-muted)]',
        count: 'text-[var(--foreground)]',
    },
}

export function AdminTriagePanel({ triage }: { triage: AdminTriage }) {
    const tiles = buildTiles(triage)
    const allClear = tiles.every((t) => t.count === 0)

    return (
        <section className="mb-6">
            <header className="mb-3 flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-[var(--foreground)]">Operational triage</h2>
                    <p className="text-xs text-[var(--foreground-muted)]">
                        {allClear ? 'All clear — nothing needs your attention.' : 'Items needing attention right now.'}
                    </p>
                </div>
                {allClear && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            </header>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {tiles.map((tile) => {
                    const Icon = tile.icon
                    const tone = toneClasses[tile.tone]
                    return (
                        <Link
                            key={tile.key}
                            href={tile.href}
                            className={`flex flex-col gap-1 rounded-xl border p-3 transition-colors ${tone.card}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <Icon className={`h-4 w-4 ${tone.icon}`} />
                                <span className={`text-xl font-bold leading-none ${tone.count}`}>{tile.count}</span>
                            </div>
                            <div className="mt-1 text-xs font-medium leading-tight text-[var(--foreground)]">
                                {tile.label}
                            </div>
                            {tile.detail && (
                                <div className="text-[10px] uppercase tracking-wide text-[var(--foreground-muted)]">
                                    {tile.detail}
                                </div>
                            )}
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}
