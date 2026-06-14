import { createClient, createAdminClient } from '@/lib/supabase/server'

export type BadgeTier = 'bronze' | 'silver' | 'gold'

export interface Badge {
    code: string
    name: string
    description: string
    icon: string
    tier: BadgeTier
    category: string
    sort_order: number
}

export interface UserBadge extends Badge {
    earned: boolean
    earned_at: string | null
}

/**
 * The badge catalogue plus which ones the signed-in user has earned.
 *
 * A small set of badges is DERIVED from current profile state at read time
 * (welcome / profile_complete / fa_verified) so the section is meaningful
 * before event-driven awarding exists. The rest come from the user_badges
 * table. Persistent, event-driven awarding (first match, ten matches, …) is a
 * follow-up that will call `awardBadge`.
 */
export async function getMyBadges(): Promise<UserBadge[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const [{ data: catalog }, { data: earnedRows }, { data: profile }, { data: ref }] = await Promise.all([
        supabase.from('badges').select('*').eq('active', true).order('sort_order'),
        supabase.from('user_badges').select('badge_code, earned_at').eq('user_id', user.id),
        supabase.from('profiles').select('avatar_url, phone, postcode, role, club_name').eq('id', user.id).maybeSingle(),
        supabase.from('referee_profiles').select('fa_id, fa_verification_status').eq('profile_id', user.id).maybeSingle(),
    ])

    const earnedMap = new Map((earnedRows || []).map((e) => [e.badge_code as string, e.earned_at as string]))

    // Read-time derivations — cheap and idempotent; no writes.
    const derived = new Set<string>(['welcome'])
    if (profile) {
        const checks = [!!profile.avatar_url, !!profile.phone, !!profile.postcode]
        if (profile.role === 'coach') checks.push(!!profile.club_name)
        if (profile.role === 'referee') checks.push(!!ref?.fa_id)
        if (checks.every(Boolean)) derived.add('profile_complete')
    }
    if (ref?.fa_verification_status === 'verified') derived.add('fa_verified')

    return (catalog || []).map((b) => {
        const badge = b as Badge
        return {
            ...badge,
            earned: earnedMap.has(badge.code) || derived.has(badge.code),
            earned_at: earnedMap.get(badge.code) ?? null,
        }
    })
}

/**
 * Award a badge to a user (idempotent). Service-role only — intended for future
 * event hooks (e.g. on match completion). No-op if the service-role key is
 * missing or the badge is already held.
 */
export async function awardBadge(userId: string, code: string): Promise<void> {
    const admin = createAdminClient()
    if (!admin) return
    await admin
        .from('user_badges')
        .upsert({ user_id: userId, badge_code: code }, { onConflict: 'user_id,badge_code', ignoreDuplicates: true })
}
