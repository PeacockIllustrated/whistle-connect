import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NotificationTestPanel } from '@/components/app/NotificationTestPanel'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default async function AdminNotificationsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        redirect('/app')
    }

    // Fetch all users for the target selector
    const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .order('full_name')

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            <Link
                href="/app"
                className="flex items-center gap-1 text-sm text-[var(--color-primary)] font-medium mb-4 hover:underline"
            >
                <ChevronLeft className="w-4 h-4" />
                Back to Dashboard
            </Link>

            <header className="mb-6">
                <h1 className="text-2xl font-bold mb-1">Notification Testing</h1>
                <p className="text-[var(--foreground-muted)]">
                    Send test notifications to verify in-app and push delivery across all categories.
                </p>
            </header>

            <NotificationTestPanel
                currentUserId={user.id}
                users={users || []}
            />
        </div>
    )
}
