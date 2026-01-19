import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app/AppHeader'
import { BottomNav } from '@/components/app/BottomNav'
import { ToastProvider } from '@/components/ui/Toast'
import { PushNotificationManager } from '@/components/app/PushNotificationManager'

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    // Get user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    // Get unread message count (placeholder for now)
    const unreadMessages = 0

    // Get pending offers count for referees
    let offerCount = 0
    if (profile?.role === 'referee') {
        const { count } = await supabase
            .from('booking_offers')
            .select('*', { count: 'exact', head: true })
            .eq('referee_id', user.id)
            .eq('status', 'sent')
        offerCount = count || 0
    }

    return (
        <ToastProvider>
            <div className="min-h-screen bg-[var(--background)]">
                <AppHeader
                    userName={profile?.full_name}
                    userRole={profile?.role}
                    notificationCount={0}
                />

                <PushNotificationManager />

                <main className="pt-[var(--header-height)] pb-[var(--bottom-nav-height)]">
                    {children}
                </main>

                <BottomNav
                    unreadMessages={unreadMessages}
                    userRole={profile?.role}
                    offerCount={offerCount}
                />
            </div>
        </ToastProvider>
    )
}
