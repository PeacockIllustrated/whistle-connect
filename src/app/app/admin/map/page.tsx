import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MapClient } from './MapClient'

export default async function AdminMapPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') redirect('/app')

    return <MapClient />
}
