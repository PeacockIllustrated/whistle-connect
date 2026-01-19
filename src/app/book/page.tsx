'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { ActionCard } from '@/components/app/ActionCard'

export default function BookInterstitialPage() {
    const router = useRouter()
    const supabase = createClient()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function checkUser() {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            setLoading(false)
        }
        checkUser()
    }, [supabase])

    const handleChoice = (path: string) => {
        router.push(path)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
            {/* Header */}
            <header className="bg-[var(--neutral-900)] text-white py-4 px-4">
                <div className="max-w-[var(--content-max-width)] mx-auto flex items-center gap-3">
                    <Link href="/" className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
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
                    <button
                        onClick={() => handleChoice('/book/individual')}
                        className="w-full text-left"
                    >
                        <ActionCard
                            title="Individual Games"
                            subtitle="Book a referee for a single match or specific event"
                            icon={
                                <div className="w-12 h-12 rounded-xl bg-[var(--wc-blue)]/10 flex items-center justify-center text-[var(--wc-blue)]">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            }
                        />
                    </button>

                    <button
                        onClick={() => handleChoice('/book/central')}
                        className="w-full text-left"
                    >
                        <ActionCard
                            title="Central Venue"
                            subtitle="Arrange referees for multiple games at a fixed location"
                            icon={
                                <div className="w-12 h-12 rounded-xl bg-[var(--wc-red)]/10 flex items-center justify-center text-[var(--wc-red)]">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                            }
                        />
                    </button>

                    <div className="mt-8 text-center pt-8 border-t border-[var(--border-color)]">
                        <Link href="/auth/login" className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">
                            Already have an account? Sign in
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    )
}
