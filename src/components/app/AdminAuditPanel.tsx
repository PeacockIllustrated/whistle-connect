import { ROADMAP_ITEMS, type RoadmapStatus } from '@/lib/admin/roadmap'
import { CheckCircle2, CircleDot, CircleDashed } from 'lucide-react'

const statusMeta: Record<RoadmapStatus, { label: string; icon: typeof CheckCircle2; iconClass: string; pillClass: string }> = {
    done: {
        label: 'Done',
        icon: CheckCircle2,
        iconClass: 'text-emerald-600',
        pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    'in-progress': {
        label: 'In progress',
        icon: CircleDot,
        iconClass: 'text-amber-600',
        pillClass: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    planned: {
        label: 'Planned',
        icon: CircleDashed,
        iconClass: 'text-slate-500',
        pillClass: 'bg-slate-50 text-slate-600 border-slate-200',
    },
}

export function AdminAuditPanel() {
    const grouped = {
        'in-progress': ROADMAP_ITEMS.filter((i) => i.status === 'in-progress'),
        planned: ROADMAP_ITEMS.filter((i) => i.status === 'planned'),
        done: ROADMAP_ITEMS.filter((i) => i.status === 'done'),
    }
    const order: RoadmapStatus[] = ['in-progress', 'planned', 'done']

    return (
        <section className="mb-6 rounded-xl border border-[var(--border-color)] bg-white p-4">
            <header className="mb-3 flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-[var(--foreground)]">Platform health & roadmap</h2>
                    <p className="text-xs text-[var(--foreground-muted)]">What is shipped, what is in flight, what is next.</p>
                </div>
            </header>

            <ul className="space-y-2">
                {order.flatMap((status) =>
                    grouped[status].map((item) => {
                        const meta = statusMeta[item.status]
                        const Icon = meta.icon
                        return (
                            <li
                                key={item.title}
                                className="flex items-start gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--neutral-50)] px-3 py-2.5"
                            >
                                <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${meta.iconClass}`} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-medium text-[var(--foreground)]">{item.title}</span>
                                        <span
                                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.pillClass}`}
                                        >
                                            {meta.label}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">{item.detail}</p>
                                </div>
                            </li>
                        )
                    }),
                )}
            </ul>
        </section>
    )
}
