'use server'

import { createClient } from '@/lib/supabase/server'

export interface MapReferee {
    id: string
    full_name: string
    avatar_url: string | null
    latitude: number
    longitude: number
    level: string | null
    is_available: boolean
    reliability_score: number
    average_rating: number
    total_matches_completed: number
    distance_km: number
}

export async function getMapReferees(radiusKm: number = 30): Promise<{ data?: MapReferee[]; error?: string; center?: { lat: number; lng: number } }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Get coach's location
    const { data: profile } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('id', user.id)
        .single()

    if (!profile?.latitude || !profile?.longitude) {
        return { error: 'Please set your postcode in your profile to use the map' }
    }

    const center = { lat: profile.latitude, lng: profile.longitude }

    // Get nearby referees using the spatial RPC
    const { data, error } = await supabase.rpc('find_referees_within_radius', {
        p_latitude: profile.latitude,
        p_longitude: profile.longitude,
        p_radius_km: radiusKm,
    })

    if (error) return { error: error.message }
    if (!data || data.length === 0) return { data: [], center }

    // RPC returns profile_id, not id. Fetch lat/lon + reliability separately.
    const refereeIds = (data as { profile_id: string }[]).map(r => r.profile_id)

    const [{ data: profiles }, { data: refProfiles }] = await Promise.all([
        supabase.from('profiles').select('id, latitude, longitude').in('id', refereeIds),
        supabase.from('referee_profiles').select('profile_id, reliability_score, average_rating, total_matches_completed').in('profile_id', refereeIds),
    ])

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))
    const refMap = new Map((refProfiles || []).map(r => [r.profile_id, r]))

    const referees: MapReferee[] = (data as {
        profile_id: string
        full_name: string
        avatar_url: string | null
        level: string | null
        is_available: boolean
        distance_km: number
    }[])
        .filter(r => {
            const p = profileMap.get(r.profile_id)
            return p?.latitude && p?.longitude
        })
        .map(r => {
            const p = profileMap.get(r.profile_id)!
            const rp = refMap.get(r.profile_id)
            return {
                id: r.profile_id,
                full_name: r.full_name,
                avatar_url: r.avatar_url,
                latitude: p.latitude!,
                longitude: p.longitude!,
                level: r.level,
                is_available: r.is_available ?? false,
                reliability_score: rp?.reliability_score ?? 0,
                average_rating: rp?.average_rating ?? 0,
                total_matches_completed: rp?.total_matches_completed ?? 0,
                distance_km: r.distance_km,
            }
        })

    return { data: referees, center }
}
