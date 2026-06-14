import { createElement, type ReactElement } from 'react'
import { Flag, ShieldCheck, BadgeCheck, CalendarCheck, Zap, Star, Award, type LucideIcon } from 'lucide-react'
import type { AchTier } from '@/lib/achievements'

export const ICON: Record<string, LucideIcon> = {
    flag: Flag,
    shield: ShieldCheck,
    badge: BadgeCheck,
    calendar: CalendarCheck,
    zap: Zap,
    star: Star,
}

export function iconFor(key: string): LucideIcon {
    return ICON[key] ?? Award
}

/** Render a track icon without declaring a component during render. */
export function badgeIcon(key: string, props: { className?: string; color?: string; strokeWidth?: number }): ReactElement {
    return createElement(iconFor(key), props)
}

export const TIER_NAME: Record<AchTier, string> = {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
}

/** Inline-style gradient per tier (kept off Tailwind so the metallics stay exact). */
export const TIER_GRAD: Record<AchTier, string> = {
    bronze: 'linear-gradient(160deg,#e7b07a,#b3712f)',
    silver: 'linear-gradient(160deg,#e3e8ef,#9aa6b6)',
    gold: 'linear-gradient(160deg,#f6d27c,#d99a17)',
    platinum: 'linear-gradient(160deg,#d4def0,#7f93ad)',
}

export const TIER_GLOW: Record<AchTier, string> = {
    bronze: '#b3712f',
    silver: '#8b97a8',
    gold: '#d99a17',
    platinum: '#6f8198',
}

export const TIER_PILL: Record<AchTier, string> = {
    bronze: 'bg-amber-50 text-amber-700',
    silver: 'bg-slate-100 text-slate-600',
    gold: 'bg-yellow-50 text-yellow-700',
    platinum: 'bg-slate-100 text-slate-600',
}

/** Fraction (0..1) the rail should be filled for a track. */
export function railFill(nodes: { state: string; frac: number }[]): number {
    const n = nodes.length
    if (n <= 1) return nodes[0]?.state === 'earned' ? 1 : 0
    const ci = nodes.findIndex((nd) => nd.state === 'current')
    if (ci < 0) return 1 // all earned
    const frac = nodes[ci].frac
    return Math.max(0, ((ci - 1) + frac) / (n - 1))
}
