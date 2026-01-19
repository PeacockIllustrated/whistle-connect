'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { AvailabilitySlot } from '@/lib/types'

export async function getAvailability() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized', data: null }
    }

    const { data, error } = await supabase
        .from('referee_date_availability')
        .select('*')
        .eq('referee_id', user.id)

    if (error) {
        return { error: error.message, data: null }
    }

    return { data, error: null }
}

export async function getDateAvailability(date: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized', data: null }
    }

    const { data, error } = await supabase
        .from('referee_date_availability')
        .select('*')
        .eq('referee_id', user.id)
        .eq('date', date)

    if (error) {
        return { error: error.message, data: null }
    }

    return { data, error: null }
}

export async function updateDateAvailability(date: string, slots: { start_time: string, end_time: string }[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Delete existing availability for this date
    await supabase
        .from('referee_date_availability')
        .delete()
        .eq('referee_id', user.id)
        .eq('date', date)

    // Insert new availability
    if (slots.length > 0) {
        const slotsToInsert = slots.map(slot => ({
            referee_id: user.id,
            date,
            start_time: slot.start_time,
            end_time: slot.end_time,
        }))

        const { error } = await supabase
            .from('referee_date_availability')
            .insert(slotsToInsert)

        if (error) {
            return { error: error.message }
        }
    }

    revalidatePath('/app/availability')
    return { success: true }
}

export async function getRefereeProfile() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized', data: null }
    }

    const { data, error } = await supabase
        .from('referee_profiles')
        .select('*')
        .eq('profile_id', user.id)
        .single()

    if (error) {
        return { error: error.message, data: null }
    }

    return { data, error: null }
}

export async function updateRefereeProfile(updates: { central_venue_opt_in?: boolean, county?: string }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { error } = await supabase
        .from('referee_profiles')
        .update(updates)
        .eq('profile_id', user.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/app/availability')
    return { success: true }
}
