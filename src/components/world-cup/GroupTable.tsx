import type { WcTeam } from '@/lib/world-cup/types'
import { FlagImage } from './TeamBits'
import { cn } from '@/lib/utils'

export function GroupTable({ letter, teams }: { letter: string; teams: WcTeam[] }) {
    return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-white overflow-hidden">
            <div className="flex items-center gap-2 bg-[var(--wc-ink)] px-3 py-2 text-white">
                <span className="text-sm font-bold">Group {letter}</span>
            </div>
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-[var(--foreground-muted)]">
                        <th className="py-1.5 pl-3 text-left font-medium">Team</th>
                        <th className="px-1 text-center font-medium">P</th>
                        <th className="px-1 text-center font-medium">GD</th>
                        <th className="py-1.5 pr-3 text-center font-medium">Pts</th>
                    </tr>
                </thead>
                <tbody>
                    {teams.map((t, i) => {
                        const gd = t.goals_for - t.goals_against
                        const qualifying = i < 2
                        return (
                            <tr
                                key={t.code}
                                className={cn(
                                    'border-t border-[var(--border-color)]',
                                    t.eliminated && 'opacity-50',
                                )}
                            >
                                <td className="py-2 pl-3">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={cn(
                                                'inline-block h-1.5 w-1.5 rounded-full',
                                                qualifying ? 'bg-[var(--wc-green)]' : 'bg-transparent',
                                            )}
                                            aria-hidden
                                        />
                                        <FlagImage countryCode={t.country_code} code={t.code} height={14} />
                                        <span className={cn('font-medium', t.eliminated && 'line-through')}>{t.name}</span>
                                    </div>
                                </td>
                                <td className="px-1 text-center text-[var(--foreground-muted)]">{t.played}</td>
                                <td className="px-1 text-center text-[var(--foreground-muted)]">
                                    {gd > 0 ? `+${gd}` : gd}
                                </td>
                                <td className="py-2 pr-3 text-center font-bold">{t.group_points}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
