import type { WcMatch, WcTeam, MatchStage } from '@/lib/world-cup/types'
import { FlagImage } from './TeamBits'
import { cn } from '@/lib/utils'

const STAGE_COLUMNS: { stage: MatchStage; label: string }[] = [
    { stage: 'r32', label: 'Round of 32' },
    { stage: 'r16', label: 'Round of 16' },
    { stage: 'qf', label: 'Quarter-finals' },
    { stage: 'sf', label: 'Semi-finals' },
    { stage: 'final', label: 'Final' },
]

function TeamRow({
    code,
    label,
    score,
    team,
    winner,
}: {
    code: string | null
    label: string | null
    score: number | null
    team?: WcTeam
    winner: boolean
}) {
    return (
        <div className={cn('flex items-center justify-between gap-2 px-2 py-1.5', winner && 'font-bold')}>
            <span className="flex items-center gap-1.5 truncate text-sm">
                {team ? (
                    <FlagImage countryCode={team.country_code} code={team.code} height={13} />
                ) : (
                    <span className="inline-block h-[13px] w-[20px] rounded-[2px] bg-[var(--neutral-200)]" aria-hidden />
                )}
                <span className="truncate">{team?.name ?? code ?? label ?? 'TBD'}</span>
            </span>
            <span className="text-sm tabular-nums text-[var(--foreground-muted)]">{score ?? ''}</span>
        </div>
    )
}

export function Bracket({
    matches,
    teamByCode,
}: {
    matches: WcMatch[]
    teamByCode: Map<string, WcTeam>
}) {
    return (
        <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
                {STAGE_COLUMNS.map((col) => {
                    const stageMatches = matches.filter((m) => m.stage === col.stage)
                    return (
                        <div key={col.stage} className="flex w-56 shrink-0 flex-col gap-3">
                            <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--foreground-muted)]">
                                {col.label}
                            </h3>
                            {stageMatches.length === 0 ? (
                                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-color)] p-4 text-center text-xs text-[var(--foreground-muted)]">
                                    To be decided
                                </div>
                            ) : (
                                stageMatches.map((m) => {
                                    const homeWin = m.winner_team_code != null && m.winner_team_code === m.home_team_code
                                    const awayWin = m.winner_team_code != null && m.winner_team_code === m.away_team_code
                                    return (
                                        <div
                                            key={m.id}
                                            className="divide-y divide-[var(--border-color)] rounded-[var(--radius-md)] border border-[var(--border-color)] bg-white"
                                        >
                                            <TeamRow
                                                code={m.home_team_code}
                                                label={m.home_label}
                                                score={m.home_score}
                                                team={m.home_team_code ? teamByCode.get(m.home_team_code) : undefined}
                                                winner={homeWin}
                                            />
                                            <TeamRow
                                                code={m.away_team_code}
                                                label={m.away_label}
                                                score={m.away_score}
                                                team={m.away_team_code ? teamByCode.get(m.away_team_code) : undefined}
                                                winner={awayWin}
                                            />
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
