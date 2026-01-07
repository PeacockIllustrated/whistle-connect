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
        .from('referee_availability')
        .select('*')
        .eq('referee_id', user.id)

    if (error) {
        return { error: error.message, data: null }
    }

    return { data, error: null }
}

export async function setAvailability(slots: AvailabilitySlot[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Delete existing availability
    await supabase
        .from('referee_availability')
        .delete()
        .eq('referee_id', user.id)

    // Insert new availability
    if (slots.length > 0) {
        const slotsToInsert = slots.map(slot => ({
            referee_id: user.id,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
        }))

        const { error } = await supabase
            .from('referee_availability')
            .insert(slotsToInsert)

        if (error) {
            return { error: error.message }
        }
    }

    revalidatePath('/app/availability')
    revalidatePath('/app')
    return { success: true }
}
