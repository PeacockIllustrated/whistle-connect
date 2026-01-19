'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { UK_COUNTIES } from '@/lib/constants'

export default function CentralBookingPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        county: '',
        match_date: '',
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const params = new URLSearchParams({
            type: 'central',
            county: formData.county,
            date: formData.match_date,
        })
        router.push(`/app/bookings/new?${params.toString()}`)
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
            <header className="bg-[var(--neutral-900)] text-white py-4 px-4">
                <div className="max-w-[var(--content-max-width)] mx-auto flex items-center gap-3">
                    <Link href="/book" className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <h1 className="text-lg font-semibold tracking-tight">Central Venue Booking</h1>
                </div>
            </header>

            <main className="flex-1 max-w-[var(--content-max-width)] mx-auto w-full px-4 py-8">
                <div className="bg-white rounded-2xl border border-[var(--border-color)] p-6 shadow-sm">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-2">Basic Details</h2>
                        <p className="text-[var(--foreground-muted)] text-sm">
                            Enter the core details for your central venue event to view available referees.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                            <Select
                                label="County"
                                options={UK_COUNTIES.map(c => ({ value: c, label: c }))}
                                value={formData.county}
                                onChange={(e) => setFormData(prev => ({ ...prev, county: e.target.value }))}
                                placeholder="Select county"
                                required
                            />

                            <Input
                                label="Match Date"
                                type="date"
                                value={formData.match_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, match_date: e.target.value }))}
                                min={new Date().toISOString().split('T')[0]}
                                required
                            />
                        </div>

                        <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold bg-[var(--wc-red)] hover:bg-[#a11214] text-white">
                            Continue to Booking
                        </Button>
                    </form>
                </div>
            </main>
        </div>
    )
}
