'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, CalendarDays, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ActionCard } from '@/components/app/ActionCard'
import { RoleAccessDenied } from '@/components/app/RoleAccessDenied'
import { UserRole } from '@/lib/types'

export default function BookInterstitialPage() {
    const router = useRouter()
    const supabase = createClient()
    const [user, setUser] = useState<any>(null)
    const [userRole, setUserRole] = useState<UserRole | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function checkUser() {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)

            // Redirect unauthenticated users to login
            if (!user) {
                setLoading(false)
                router.push('/auth/login?returnTo=/book')
                return
            }

            // Get user profile to check role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            setUserRole(profile?.role || null)
            setLoading(false)
        }
        checkUser()
    }, [supabase, router])

    const handleChoice = (path: string) => {
        router.push(path)
    }

    // Show loading state while checking auth
    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full" />
            </div>
        )
    }

    // Redirect if not authenticated
    if (!user) {
        return (
            <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full" />
            </div>
        )
    }

    // Show access denied for referees
    if (userRole === 'referee') {
        return (
            <div className="min-h-screen bg-[var(--background)]">
                <header className="bg-[var(--neutral-900)] text-white py-4 px-4">
                    <div className="max-w-[var(--content-max-width)] mx-auto flex items-center gap-3">
                        <Link href="/app" className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-lg font-semibold tracking-tight">Book a Referee</h1>
                    </div>
                </header>
                <RoleAccessDenied
                    requiredRole="coach"
                    currentRole={userRole}
                    featureName="Book a Referee"
                    description="This feature is for coaches to book referees for their matches. As a referee, you'll receive booking offers from coaches."
                />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
            {/* Header */}
            <header className="bg-[var(--neutral-900)] text-white py-4 px-4">
                <div className="max-w-[var(--content-max-width)] mx-auto flex items-center gap-3">
                    <Link href="/" className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-lg font-semibold tracking-tight">Book a Referee</h1>
                </div>
            </header>

            <main className="flex-1 max-w-[var(--content-max-width)] mx-auto w-full px-4 py-8">
                <div className="mb-10 text-center">
                    <h2 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">How would you like to book?</h2>
                    <p className="text-[var(--foreground-muted)] mt-2">Select the type of booking you need</p>
                </div>

                <div className="space-y-4">
                    <ActionCard
                        onClick={() => handleChoice('/book/individual')}
                        title="Individual Games"
                        subtitle="Book a referee for a single match or specific event"
                        icon={
                            <div className="w-12 h-12 rounded-xl bg-[var(--wc-blue)]/10 flex items-center justify-center text-[var(--wc-blue)]">
                                <CalendarDays className="w-6 h-6" />
                            </div>
                        }
                    />

                    <ActionCard
                        onClick={() => handleChoice('/book/central')}
                        title="Central Venue"
                        subtitle="Arrange referees for multiple games at a fixed location"
                        icon={
                            <div className="w-12 h-12 rounded-xl bg-[var(--wc-red)]/10 flex items-center justify-center text-[var(--wc-red)]">
                                <MapPin className="w-6 h-6" />
                            </div>
                        }
                    />
                </div>
            </main>
        </div>
    )
}
