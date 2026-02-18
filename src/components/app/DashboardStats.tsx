export interface StatItem {
    label: string
    value: number | string
    color?: 'default' | 'green' | 'amber' | 'red' | 'blue'
}

export function DashboardStats({ stats }: { stats: StatItem[] }) {
    const colorConfig = {
        default: {
            text: 'text-[var(--foreground)]',
            bg: 'bg-[var(--neutral-100)]',
            border: 'border-[var(--neutral-200)]',
            dot: 'bg-[var(--neutral-400)]',
        },
        green: {
            text: 'text-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-100',
            dot: 'bg-emerald-500',
        },
        amber: {
            text: 'text-amber-600',
            bg: 'bg-amber-50',
            border: 'border-amber-100',
            dot: 'bg-amber-500',
        },
        red: {
            text: 'text-red-600',
            bg: 'bg-red-50',
            border: 'border-red-100',
            dot: 'bg-red-500',
        },
        blue: {
            text: 'text-blue-600',
            bg: 'bg-blue-50',
            border: 'border-blue-100',
            dot: 'bg-blue-500',
        },
    }

    return (
        <div className="grid grid-cols-2 gap-2.5">
            {stats.map((stat) => {
                const config = colorConfig[stat.color || 'default']
                return (
                    <div
                        key={stat.label}
                        className={`relative overflow-hidden rounded-xl border ${config.border} ${config.bg} p-3 transition-all duration-200`}
                    >
                        {/* Subtle accent dot */}
                        <div className={`absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full ${config.dot} opacity-60`} />

                        <span className={`text-2xl font-bold tracking-tight ${config.text}`}>
                            {stat.value}
                        </span>
                        <span className="block text-[11px] font-medium text-[var(--foreground-muted)] mt-0.5 leading-tight">
                            {stat.label}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
