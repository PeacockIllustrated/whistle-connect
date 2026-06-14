import { createClient } from '@/lib/supabase/server'

// ----------------------------------------------------------------------------
// Achievements — tiered progression "tracks" computed live from existing data.
// (1st-draft frame of reference: tracks/thresholds are config here, progress is
//  derived; persistent awarding via user_badges can layer on later.)
// ----------------------------------------------------------------------------

export type AchTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type AchState = 'earned' | 'current' | 'locked'

export interface AchNode {
    req: number
    tier: AchTier
    name: string
    state: AchState
    /** 0..1 progress within this tier (only meaningful for the current node). */
    frac: number
}

export interface AchTrack {
    key: string
    role: 'Referee' | 'Coach'
    name: string
    icon: string
    /** When true the node "req" represents a step rather than a count (credentials). */
    unit?: boolean
    value: number
    nodes: AchNode[]
}

export interface Achievements {
    tracks: AchTrack[]
    totalTiersEarned: number
    next: { trackName: string; nodeName: string; tier: AchTier; value: number; req: number; frac: number } | null
}

type TrackDef = {
    key: string
    role: 'Referee' | 'Coach'
    name: string
    icon: string
    unit?: boolean
    nodes: { req: number; tier: AchTier; name: string }[]
}

const TRACK_DEFS: TrackDef[] = [
    {
        key: 'matches', role: 'Referee', name: 'Matches refereed', icon: 'flag',
        nodes: [
            { req: 1, tier: 'bronze', name: 'First whistle' },
            { req: 10, tier: 'silver', name: 'Ten up' },
            { req: 50, tier: 'gold', name: 'Fifty club' },
            { req: 100, tier: 'platinum', name: 'Centurion' },
        ],
    },
    {
        key: 'reliability', role: 'Referee', name: 'Reliability streak', icon: 'shield',
        nodes: [
            { req: 5, tier: 'bronze', name: 'Dependable' },
            { req: 20, tier: 'silver', name: 'Solid' },
            { req: 50, tier: 'gold', name: 'Mr Reliable' },
            { req: 100, tier: 'platinum', name: 'The Rock' },
        ],
    },
    {
        key: 'credentials', role: 'Referee', name: 'Credentials', icon: 'badge', unit: true,
        nodes: [
            { req: 1, tier: 'bronze', name: 'FA Verified' },
            { req: 2, tier: 'silver', name: 'DBS Cleared' },
            { req: 3, tier: 'gold', name: 'Fully Vetted' },
        ],
    },
    {
        key: 'bookings', role: 'Coach', name: 'Bookings made', icon: 'calendar',
        nodes: [
            { req: 1, tier: 'bronze', name: 'First booking' },
            { req: 10, tier: 'silver', name: 'Regular' },
            { req: 50, tier: 'gold', name: 'Stalwart' },
            { req: 200, tier: 'platinum', name: 'Powerhouse' },
        ],
    },
]

export async function getMyAchievements(): Promise<Achievements> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { tracks: [], totalTiersEarned: 0, next: null }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const role = profile?.role

    const values: Record<string, number> = {}

    if (role === 'referee') {
        const { data: ref } = await supabase
            .from('referee_profiles')
            .select('total_matches_completed, total_cancellations, fa_verification_status, dbs_status, safeguarding_status')
            .eq('profile_id', user.id)
            .maybeSingle()
        const matches = ref?.total_matches_completed ?? 0
        const cancels = ref?.total_cancellations ?? 0
        values.matches = matches
        values.reliability = Math.max(0, matches - cancels)
        values.credentials = [
            ref?.fa_verification_status === 'verified',
            ref?.dbs_status === 'verified',
            ref?.safeguarding_status === 'verified',
        ].filter(Boolean).length
    } else if (role === 'coach') {
        const { count } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('coach_id', user.id)
            .is('deleted_at', null)
        values.bookings = count ?? 0
    }

    const defs = TRACK_DEFS.filter((d) => values[d.key] !== undefined)

    let totalTiersEarned = 0
    let next: Achievements['next'] = null

    const tracks: AchTrack[] = defs.map((def) => {
        const value = values[def.key] ?? 0
        const ci = def.nodes.findIndex((n) => value < n.req) // current index, -1 if all earned
        const nodes: AchNode[] = def.nodes.map((nd, i) => {
            const prev = i > 0 ? def.nodes[i - 1].req : 0
            const frac = Math.max(0, Math.min(1, (value - prev) / (nd.req - prev)))
            const state: AchState = value >= nd.req ? 'earned' : i === ci ? 'current' : 'locked'
            if (state === 'earned') totalTiersEarned++
            return { req: nd.req, tier: nd.tier, name: nd.name, state, frac }
        })
        if (ci >= 0) {
            const cn = nodes[ci]
            if (!next || cn.frac > next.frac) {
                next = { trackName: def.name, nodeName: cn.name, tier: cn.tier, value, req: cn.req, frac: cn.frac }
            }
        }
        return { key: def.key, role: def.role, name: def.name, icon: def.icon, unit: def.unit, value, nodes }
    })

    return { tracks, totalTiersEarned, next }
}
