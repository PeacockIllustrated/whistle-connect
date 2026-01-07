import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/app/AppHeader'
import { BottomNav } from '@/components/app/BottomNav'
import { ToastProvider } from '@/components/ui/Toast'

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

    return (
        <ToastProvider>
            <div className="min-h-screen bg-[var(--background)]">
                <AppHeader
                    userName={profile?.full_name}
                    userRole={profile?.role}
                    notificationCount={0}
                />

                <main className="pt-[var(--header-height)] pb-[var(--bottom-nav-height)]">
                    {children}
                </main>

                <BottomNav unreadMessages={unreadMessages} />
            </div>
        </ToastProvider>
    )
}
