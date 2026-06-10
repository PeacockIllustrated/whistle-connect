import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app/AppHeader'
import { BottomNav } from '@/components/app/BottomNav'
import { ToastProvider } from '@/components/ui/Toast'
import { PushNotificationManager } from '@/components/app/PushNotificationManager'
import { InstallPrompt } from '@/components/app/InstallPrompt'
import { UnreadMessagesProvider } from '@/components/app/UnreadMessagesProvider'
import { BookingUpdatesProvider } from '@/components/app/BookingUpdatesProvider'
import { ParentalConsentBanner } from '@/components/app/ParentalConsentBanner'
import SplashScreen from '@/components/ui/SplashScreen'

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

    // Get pending offers count for referees. Filter must match getMyOffers
    // (feed/actions.ts) so the badge in BottomNav / Feed tab matches what
    // the My Offers list actually renders. Specifically: skip offers whose
    // underlying booking has been soft-deleted by the coach.
    let offerCount = 0
    if (profile?.role === 'referee') {
        const { count } = await supabase
            .from('booking_offers')
            .select('*, booking:bookings!inner(deleted_at)', { count: 'exact', head: true })
            .eq('referee_id', user.id)
            .eq('status', 'sent')
            .is('booking.deleted_at', null)
        offerCount = count || 0
    }

    // Under-18 referees: surface a banner while the account is locked pending
    // (or after a declined) parental/guardian consent. The hard gates are
    // enforced server-side elsewhere; this just makes the state visible.
    let parentalConsentStatus: string | null = null
    let parentConsentEmail: string | null = null
    if (profile?.role === 'referee') {
        const { data: refProfile } = await supabase
            .from('referee_profiles')
            .select('parental_consent_status')
            .eq('profile_id', user.id)
            .single()
        parentalConsentStatus = refProfile?.parental_consent_status ?? null
        if (parentalConsentStatus === 'awaiting' || parentalConsentStatus === 'rejected') {
            const { data: consent } = await supabase
                .from('parental_consents')
                .select('parent_email')
                .eq('referee_id', user.id)
                .maybeSingle()
            parentConsentEmail = consent?.parent_email ?? null
        }
    }

    return (
        <ToastProvider>
            <SplashScreen />
            <UnreadMessagesProvider
                userId={user.id}
                initialThreadData={threadData}
                initialUnreadCounts={initialUnreadCounts}
            >
                <BookingUpdatesProvider userId={user.id} initialOfferCount={offerCount}>
                    <div className="min-h-screen bg-[var(--background)]">
                        <AppHeader
                            userRole={profile?.role}
                        />

                        <PushNotificationManager />
                        <InstallPrompt />

                        <main className="pt-[calc(var(--header-height)+24px)] pb-[calc(var(--bottom-nav-height)+24px)]">
                            {(parentalConsentStatus === 'awaiting' || parentalConsentStatus === 'rejected') && (
                                <ParentalConsentBanner
                                    status={parentalConsentStatus as 'awaiting' | 'rejected'}
                                    parentEmail={parentConsentEmail}
                                />
                            )}
                            {children}
                        </main>

                        <BottomNav
                            userRole={profile?.role}
                        />
                    </div>
                </BookingUpdatesProvider>
            </UnreadMessagesProvider>
        </ToastProvider>
    )
}
