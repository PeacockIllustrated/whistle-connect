import { Trophy } from 'lucide-react'
import type { WcTeam } from '@/lib/world-cup/types'
import { FlagImage } from './TeamBits'

/** Celebratory banner shown once a champion is crowned. */
export function ChampionBanner({ team }: { team: WcTeam }) {
    return (
        <div className="wc-sheen relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--wc-ink)] to-[var(--wc-blue)] p-5 text-white shadow-lg">
            <div className="absolute inset-0 wc-stripes opacity-25" aria-hidden />
            <div className="relative flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-[var(--wc-ink)] shadow-lg">
                    <Trophy className="h-8 w-8" />
                </span>
                <div className="min-w-0">
                    <p className="wc-display text-xs tracking-[0.25em] text-amber-300">World Champions</p>
                    <div className="mt-1 flex items-center gap-2">
                        <FlagImage countryCode={team.country_code} code={team.code} height={22} />
                        <span className="wc-display text-3xl sm:text-4xl">{team.name}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
