import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDisputes } from './actions'
import Link from 'next/link'
import DisputeResolver from './DisputeResolver'

export default async function DisputesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        redirect('/app')
    }

    const { data: disputes } = await getDisputes()

    const openDisputes = disputes?.filter(d => d.status === 'open') ?? []
    const resolvedDisputes = disputes?.filter(d => d.status !== 'open') ?? []

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Disputes</h1>
                <Link href="/app" className="text-sm text-muted-foreground hover:underline">
                    &larr; Dashboard
                </Link>
            </div>

            {openDisputes.length === 0 && resolvedDisputes.length === 0 && (
                <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                    No disputes raised yet.
                </div>
            )}

            {openDisputes.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-red-600">
                        Open Disputes ({openDisputes.length})
                    </h2>
                    {openDisputes.map(dispute => (
                        <DisputeResolver key={dispute.id} dispute={dispute} />
                    ))}
                </div>
            )}

            {resolvedDisputes.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-muted-foreground">
                        Resolved ({resolvedDisputes.length})
                    </h2>
                    {resolvedDisputes.map(dispute => (
                        <div key={dispute.id} className="rounded-xl border bg-card p-4 opacity-60">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Booking: {dispute.booking_id.substring(0, 8)}...</p>
                                <span className="text-xs rounded-full bg-muted px-2 py-1">
                                    {dispute.status.replace('resolved_', 'Resolved: ')}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{dispute.reason}</p>
                            {dispute.admin_notes && (
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                    Admin: {dispute.admin_notes}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
