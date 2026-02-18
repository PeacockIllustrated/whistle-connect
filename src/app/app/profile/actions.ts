'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isValidFANumber } from '@/lib/utils'

export async function updateProfile(formData: {
    full_name: string
    postcode: string
    phone: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const { error } = await supabase
        .from('profiles')
        .update({
            full_name: formData.full_name,
            postcode: formData.postcode,
            phone: formData.phone,
            updated_at: new Date().toISOString()
        })
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
