'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function verifyReferee(refereeId: string, verified: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Verify admin role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return { error: 'Admin access required' }
    }

    const { error } = await supabase
        .from('referee_profiles')
        .update({ verified })
        .eq('profile_id', refereeId)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/app/admin/referees')
    revalidatePath(`/app/admin/referees/${refereeId}`)
    return { success: true }
}
