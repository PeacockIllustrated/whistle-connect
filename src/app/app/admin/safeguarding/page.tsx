import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMinorsQueue } from './actions'
import { SafeguardingQueue } from './SafeguardingQueue'

export default async function SafeguardingPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
    if (profile?.role !== 'admin') redirect('/app')

    const { data: rows, error } = await getMinorsQueue()

    return (
        <div className="mx-auto max-w-[var(--content-max-width)] px-4 py-6 pb-24">
            <h1 className="text-2xl font-bold">Safeguarding</h1>
            <p className="mb-6 mt-1 text-sm text-[var(--foreground-muted)]">
                Under-18 referees whose accounts are locked pending parent/guardian consent. Approving unlocks
                the account; resending re-sends the one-click approval email to the parent.
            </p>
            {error ? (
                <p className="text-sm text-red-600">{error}</p>
            ) : (
                <SafeguardingQueue rows={rows || []} />
            )}
        </div>
    )
}
