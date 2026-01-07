'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ComplianceStatus } from '@/lib/types'

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

export async function updateComplianceStatus(
    refereeId: string,
    field: 'dbs_status' | 'safeguarding_status',
    status: ComplianceStatus,
    expiresAt?: string
) {
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

    const expiryField = field === 'dbs_status' ? 'dbs_expires_at' : 'safeguarding_expires_at'

    const { error } = await supabase
        .from('referee_profiles')
        .update({
            [field]: status,
            [expiryField]: expiresAt || null,
        })
        .eq('profile_id', refereeId)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/app/admin/referees')
    revalidatePath(`/app/admin/referees/${refereeId}`)
    return { success: true }
}
