import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app/AppHeader'
import { BottomNav } from '@/components/app/BottomNav'
import { ToastProvider } from '@/components/ui/Toast'
import { PushNotificationManager } from '@/components/app/PushNotificationManager'
import { UnreadMessagesProvider } from '@/components/app/UnreadMessagesProvider'
import { BookingUpdatesProvider } from '@/components/app/BookingUpdatesProvider'

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

    // Get thread participations for unread message tracking
    const { data: participations } = await supabase
        .from('thread_participants')
        .select('thread_id, last_read_at')
        .eq('profile_id', user.id)

    // Calculate unread counts per thread
    const threadData: { threadId: string; lastReadAt: string | null }[] = []
    const initialUnreadCounts: Record<string, number> = {}

    if (participations && participations.length > 0) {
        const threadIds = participations.map(p => p.thread_id)

        const { data: allMessages } = await supabase
            .from('messages')
            .select('thread_id, created_at')
            .in('thread_id', threadIds)

        if (allMessages) {
            for (const msg of allMessages) {
                const p = participations.find(p => p.thread_id === msg.thread_id)
                const lastRead = p?.last_read_at || '1970-01-01'
                if (new Date(msg.created_at) > new Date(lastRead)) {
                    initialUnreadCounts[msg.thread_id] = (initialUnreadCounts[msg.thread_id] || 0) + 1
                }
            }
        }

        for (const p of participations) {
            threadData.push({ threadId: p.thread_id, lastReadAt: p.last_read_at })
        }
    }

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
            <UnreadMessagesProvider
                userId={user.id}
                initialThreadData={threadData}
                initialUnreadCounts={initialUnreadCounts}
            >
                <BookingUpdatesProvider userId={user.id}>
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
                            userRole={profile?.role}
                            offerCount={offerCount}
                        />
                    </div>
                </BookingUpdatesProvider>
            </UnreadMessagesProvider>
        </ToastProvider>
    )
}
