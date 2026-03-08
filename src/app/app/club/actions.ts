'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { geocodePostcode } from '@/lib/mapbox/geocode'

export async function getMyClub() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized', data: null }

    // Check if user owns a club
    const { data: club } = await supabase
        .from('clubs')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()

    return { data: club, error: null }
}

export async function createClub(name: string, homePostcode: string, groundName?: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    if (!name.trim()) return { error: 'Club name is required' }
    if (!homePostcode.trim()) return { error: 'Home postcode is required' }

    // Geocode the postcode
    const geo = await geocodePostcode(homePostcode.trim().toUpperCase())

    const { data: club, error } = await supabase
        .from('clubs')
        .insert({
            owner_id: user.id,
            name: name.trim(),
            home_postcode: homePostcode.trim().toUpperCase(),
            ground_name: groundName?.trim() || null,
        })
        .select()
        .single()

    if (error) return { error: error.message }

    // Add owner as club member
    await supabase
        .from('club_members')
        .insert({
            club_id: club.id,
            profile_id: user.id,
            role: 'owner',
        })

    // Update club with geocoded location if available
    if (geo) {
        await supabase
            .from('clubs')
            .update({ latitude: geo.lat, longitude: geo.lng })
            .eq('id', club.id)
    }

    revalidatePath('/app/club')
    return { success: true, clubId: club.id }
}

export async function getClubPool() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized', data: null }

    // Get the user's club
    const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

    if (!club) return { error: 'No club found', data: null }

    const { data: pool, error } = await supabase
        .from('club_referee_pool')
        .select(`
            id,
            status,
            added_at,
            referee:profiles!club_referee_pool_referee_id_fkey(
                id, full_name, avatar_url
            )
        `)
        .eq('club_id', club.id)
        .eq('status', 'active')
        .order('added_at', { ascending: false })

    if (error) return { error: error.message, data: null }
    return { data: pool, error: null }
}

export async function addRefereeToPool(refereeId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

    if (!club) return { error: 'No club found' }

    // Verify the referee exists and is a referee
    const { data: referee } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', refereeId)
        .single()

    if (!referee || referee.role !== 'referee') return { error: 'Invalid referee' }

    const { error } = await supabase
        .from('club_referee_pool')
        .upsert({
            club_id: club.id,
            referee_id: refereeId,
            added_by: user.id,
            status: 'active',
        }, {
            onConflict: 'club_id,referee_id',
        })

    if (error) return { error: error.message }

    revalidatePath('/app/club/pool')
    return { success: true }
}

export async function removeRefereeFromPool(refereeId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { data: club } = await supabase
        .from('clubs')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

    if (!club) return { error: 'No club found' }

    const { error } = await supabase
        .from('club_referee_pool')
        .update({ status: 'removed' })
        .eq('club_id', club.id)
        .eq('referee_id', refereeId)

    if (error) return { error: error.message }

    revalidatePath('/app/club/pool')
    return { success: true }
}
