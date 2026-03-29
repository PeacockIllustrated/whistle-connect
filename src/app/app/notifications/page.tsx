import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NotificationList } from '@/components/app/NotificationList'

export default async function NotificationsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    // Fetch initial notifications server-side
    const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-bold mb-1">Notifications</h1>
                <p className="text-[var(--foreground-muted)]">
                    Stay on top of your bookings, offers, and messages.
                </p>
            </header>

            <NotificationList
                initialNotifications={notifications || []}
                userId={user.id}
            />
        </div>
    )
}
