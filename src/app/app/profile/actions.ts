'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isValidFANumber } from '@/lib/utils'
import { geocodePostcode } from '@/lib/mapbox/geocode'

export async function updateProfile(formData: {
    full_name: string
    postcode: string
    phone: string
    club_name?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // Geocode postcode to lat/lon for distance-based features
    // Geocode may fail server-side (e.g. token URL restrictions), so only update coords if successful
    const updateData: Record<string, unknown> = {
        full_name: formData.full_name,
        postcode: formData.postcode,
        phone: formData.phone,
        updated_at: new Date().toISOString()
    }

    if (formData.club_name !== undefined) {
        updateData.club_name = formData.club_name || null
    }

    if (formData.postcode) {
        const geo = await geocodePostcode(formData.postcode)
        if (geo) {
            updateData.latitude = geo.lat
            updateData.longitude = geo.lng
        }
    } else {
        // Postcode cleared — clear coords too
        updateData.latitude = null
        updateData.longitude = null
    }

    const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

    if (error) {
        console.error('Error updating profile:', error)
        return { error: error.message }
    }

    revalidatePath('/app/profile')
    return { success: true }
}

export async function updateAvatarUrl(url: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const { error } = await supabase
        .from('profiles')
        .update({
            avatar_url: url,
            updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

    if (error) {
        console.error('Error updating avatar URL:', error)
        return { error: error.message }
    }

    revalidatePath('/app/profile')
    return { success: true }
}

/**
 * Get the current user's postcode (for client-side geocoding).
 */
export async function getMyPostcode(): Promise<{ postcode?: string; hasCoords?: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('postcode, latitude, longitude')
        .eq('id', user.id)
        .single()

    if (!profile) return { error: 'Profile not found' }
    if (profile.latitude && profile.longitude) return { hasCoords: true }
    if (!profile.postcode) return { error: 'No postcode set' }

    return { postcode: profile.postcode }
}

/**
 * Save lat/lon to the current user's profile (called after client-side geocoding).
 */
export async function saveMyGeolocation(lat: number, lng: number): Promise<{ success?: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('profiles')
        .update({ latitude: lat, longitude: lng })
        .eq('id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/app/profile')
    return { success: true }
}

export async function updateFANumber(faNumber: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // Validate format if setting a number
    if (faNumber && !isValidFANumber(faNumber)) {
        return { error: 'FA number must be 8-10 digits' }
    }

    // Check for duplicates
    if (faNumber) {
        const { data: existing } = await supabase
            .from('referee_profiles')
            .select('profile_id')
            .eq('fa_id', faNumber)
            .neq('profile_id', user.id)
            .maybeSingle()
        if (existing) {
            return { error: 'This FA number is already registered to another referee' }
        }
    }

    // Update FA number and reset verification status
    const { error } = await supabase
        .from('referee_profiles')
        .update({
            fa_id: faNumber || null,
            fa_verification_status: faNumber ? 'pending' : 'not_provided',
        })
        .eq('profile_id', user.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/app/profile')
    return { success: true }
}
