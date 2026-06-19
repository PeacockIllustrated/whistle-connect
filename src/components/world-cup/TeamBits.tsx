import { Crown } from 'lucide-react'
import { flagUrl } from '@/lib/world-cup/flags'
import type { WcTeam, TeamRecord } from '@/lib/world-cup/types'
import { cn } from '@/lib/utils'

/** "+3" / "0" / "−2" — a signed goal difference. */
export function formatGoalDiff(gd: number): string {
    if (gd > 0) return `+${gd}`
    if (gd < 0) return `−${Math.abs(gd)}`
    return '0'
}

/** A flag image with a code fallback. We render flag IMAGES, never emoji. */
export function FlagImage({
    countryCode,
    code,
    height = 16,
}: {
    countryCode: string | null
    code: string
    height?: number
}) {
    const url = flagUrl(countryCode, height <= 20 ? 40 : 80)
    if (!url) {
        return (
            <span
                className="inline-flex items-center justify-center rounded-[2px] bg-[var(--neutral-200)] text-[10px] font-bold text-[var(--neutral-600)]"
                style={{ height, width: Math.round(height * 1.5) }}
            >
                {code.slice(0, 2)}
            </span>
        )
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={url}
            alt={code}
            height={height}
            width={Math.round(height * 1.5)}
            loading="lazy"
            className="rounded-[2px] object-cover shadow-[0_0_0_0.5px_rgba(0,0,0,0.12)]"
        />
    )
}

/** A team chip: flag + code/name, greyed when eliminated, crowned for champion.
 *  Pass `record` to append a compact W-D-L · GD readout. */
export function TeamPill({
    team,
    record,
    showName = false,
    className,
}: {
    team: WcTeam
    record?: TeamRecord
    showName?: boolean
    className?: string
}) {
    const champion = team.stage === 'champion'
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold',
                champion
                    ? 'bg-[var(--wc-blue)] text-white'
                    : team.eliminated
                        ? 'bg-[var(--neutral-100)] text-[var(--neutral-400)]'
                        : 'bg-[var(--neutral-100)] text-[var(--foreground)]',
                className,
            )}
        >
            <FlagImage countryCode={team.country_code} code={team.code} height={14} />
            <span className={cn(team.eliminated && !champion && 'line-through')}>
                {showName ? team.name : team.code}
            </span>
            {record && record.played > 0 && (
                <span
                    className={cn(
                        'rounded px-1 text-[11px] font-bold tabular-nums',
                        champion ? 'bg-white/20 text-white' : 'bg-white/70 text-[var(--foreground-muted)]',
                    )}
                    title={`${record.won}W ${record.drawn}D ${record.lost}L · GF ${record.goalsFor} GA ${record.goalsAgainst}`}
                >
                    {record.won}-{record.drawn}-{record.lost}
                    <span className="ml-1 opacity-70">{formatGoalDiff(record.goalDiff)}</span>
                </span>
            )}
            {champion && <Crown className="h-3.5 w-3.5 text-amber-300" aria-label="Champion" />}
        </span>
    )
}
