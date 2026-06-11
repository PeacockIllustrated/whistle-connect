'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { RecentResult } from '@/lib/world-cup/data'
import { FlagImage } from './TeamBits'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'wc-hide-results'
const HIDE_EVENT = 'wc-hide-results-change'

function readHidden(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
        return false
    }
}

// Subscribe to same-tab changes (custom event) + other-tab changes (storage).
function subscribeHidden(onChange: () => void): () => void {
    window.addEventListener(HIDE_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
        window.removeEventListener(HIDE_EVENT, onChange)
        window.removeEventListener('storage', onChange)
    }
}

function stageLabel(r: RecentResult): string {
    switch (r.stage) {
        case 'group': return r.group_letter ? `Group ${r.group_letter}` : 'Group stage'
        case 'r32': return 'Round of 32'
        case 'r16': return 'Round of 16'
        case 'qf': return 'Quarter-final'
        case 'sf': return 'Semi-final'
        case 'third_place': return 'Third place'
        case 'final': return 'Final'
        default: return ''
    }
}

type Team = RecentResult['home']

function Side({ team, win, align }: { team: Team; win: boolean; align: 'left' | 'right' }) {
    return (
        <div className={cn('flex min-w-0 items-center gap-2', align === 'right' && 'flex-row-reverse')}>
            <FlagImage countryCode={team?.country_code ?? null} code={team?.code ?? '??'} height={18} />
            <span className={cn('truncate text-sm text-[var(--foreground)]', win ? 'font-extrabold' : 'font-medium')}>
                {team?.name ?? 'TBD'}
            </span>
        </div>
    )
}

function ResultCard({ r, hidden }: { r: RecentResult; hidden: boolean }) {
    const homeWin = !!r.winnerCode && r.winnerCode === r.home?.code
    const awayWin = !!r.winnerCode && r.winnerCode === r.away?.code
    const hasPens = r.homePens != null && r.awayPens != null

    return (
        <div className="rounded-2xl border border-[var(--border-color)] bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--foreground-muted)]">{stageLabel(r)}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Side team={r.home} win={!hidden && homeWin} align="left" />
                <div className="px-1">
                    {hidden ? (
                        <span aria-label="Result hidden" className="select-none rounded-md bg-[var(--neutral-100)] px-2 py-1 text-base font-extrabold text-transparent blur-[6px]">
                            0-0
                        </span>
                    ) : (
                        <span className="rounded-md bg-[var(--background-soft)] px-2 py-1 text-base font-extrabold tabular-nums text-[var(--foreground)]">
                            {r.homeScore}-{r.awayScore}
                        </span>
                    )}
                </div>
                <Side team={r.away} win={!hidden && awayWin} align="right" />
            </div>
            {hasPens && !hidden && (
                <p className="mt-1.5 text-center text-[10px] text-[var(--foreground-muted)]">Penalties {r.homePens}-{r.awayPens}</p>
            )}
        </div>
    )
}

export function RecentResults({ results }: { results: RecentResult[] }) {
    // Read the saved preference from localStorage without an effect-driven
    // setState. useSyncExternalStore returns the server snapshot (false) during
    // SSR/hydration and the real value on the client, with no hydration mismatch.
    const hidden = useSyncExternalStore(subscribeHidden, readHidden, () => false)

    const toggle = useCallback(() => {
        try {
            localStorage.setItem(STORAGE_KEY, readHidden() ? '0' : '1')
        } catch {
            /* localStorage may be unavailable */
        }
        window.dispatchEvent(new Event(HIDE_EVENT))
    }, [])

    const blurScores = hidden

    return (
        <section className="mx-auto w-full max-w-4xl px-4 py-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="wc-display text-3xl sm:text-4xl text-[var(--foreground)]">Latest results</h2>
                {results.length > 0 && (
                    <button
                        type="button"
                        onClick={toggle}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] px-3.5 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--neutral-100)]"
                    >
                        {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {hidden ? 'Results hidden' : 'Hide results'}
                    </button>
                )}
            </div>

            {results.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-[var(--border-color)] p-8 text-center text-[var(--foreground-muted)]">
                    Results will appear here as soon as the first matches finish.
                </div>
            ) : (
                <>
                    <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                        {hidden
                            ? 'Scores are hidden so you can watch later. Flip the toggle to reveal them.'
                            : 'Planning to watch later? Use the toggle to hide every score.'}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {results.map((r) => (
                            <ResultCard key={r.id} r={r} hidden={blurScores} />
                        ))}
                    </div>
                </>
            )}
        </section>
    )
}
