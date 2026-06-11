import { WC_2026_TEAMS } from '@/lib/world-cup/teams-2026'
import { isoForFifa } from '@/lib/world-cup/flags'
import { FlagImage } from './TeamBits'

/**
 * Edge-faded, auto-scrolling strip of all 48 nations. Pure-CSS marquee (no JS) —
 * the list is duplicated so the -50% translate loops seamlessly. Pauses on hover,
 * stops entirely under prefers-reduced-motion (handled globally).
 */
export function NationsTicker({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
    const items = [...WC_2026_TEAMS, ...WC_2026_TEAMS]
    const text = tone === 'dark' ? 'text-white/80' : 'text-[var(--foreground)]'
    const border = tone === 'dark' ? 'border-white/10' : 'border-[var(--border-color)]'

    return (
        <div className={`wc-marquee-mask overflow-hidden border-y ${border} py-3`}>
            <div className="wc-marquee flex w-max items-center gap-6">
                {items.map((t, i) => (
                    <span key={`${t.code}-${i}`} className={`flex shrink-0 items-center gap-2 ${text}`}>
                        <FlagImage countryCode={isoForFifa(t.code)} code={t.code} height={16} />
                        <span className="text-xs font-bold tracking-wide">{t.code}</span>
                    </span>
                ))}
            </div>
        </div>
    )
}
