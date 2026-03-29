import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NotificationSettings } from '@/components/app/NotificationSettings'
import { getNotificationPreferences } from '../actions'

export default async function NotificationSettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    const { data: preferences } = await getNotificationPreferences()

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            <header className="mb-6">
                <h1 className="text-2xl font-bold mb-1">Notification Settings</h1>
                <p className="text-[var(--foreground-muted)]">
                    Choose which notifications you receive in-app and via push.
                </p>
            </header>

            <NotificationSettings initialPreferences={preferences || []} />
        </div>
    )
}
