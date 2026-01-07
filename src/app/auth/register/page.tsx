'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { signUp } from '@/lib/auth/actions'
import { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

const roleOptions = [
    { value: 'coach', label: 'Coach / Club Manager' },
    { value: 'referee', label: 'Referee' },
]

export default function RegisterPage() {
    const searchParams = useSearchParams()
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState<UserRole>('coach')
    const [phone, setPhone] = useState('')
    const [postcode, setPostcode] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const roleParam = searchParams.get('role')
        if (roleParam === 'referee' || roleParam === 'coach') {
            setRole(roleParam)
        }
    }, [searchParams])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const result = await signUp({
                email,
                password,
                full_name: fullName,
                role,
                phone: phone || undefined,
                postcode: postcode || undefined,
            })
            if (result?.error) {
                setError(result.error)
            } else if (result?.message) {
                // Email confirmation required
                setError(result.message)
            }
        } catch (err: any) {
            console.error('Registration error:', err)
            setError(err?.message || 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
            {/* Header */}
            <header className="bg-[var(--brand-navy)] text-white py-4 px-4">
                <div className="max-w-[var(--content-max-width)] mx-auto flex items-center gap-3">
                    <Link href="/" className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <h1 className="text-lg font-semibold">Create Account</h1>
                </div>
            </header>

            {/* Form */}
            <main className="flex-1 px-4 py-6 overflow-y-auto">
                <div className="max-w-[var(--content-max-width)] mx-auto w-full">
                    {/* Role Selection */}
                    <div className="mb-6">
                        <p className="text-sm font-medium text-[var(--foreground)] mb-3">I am a...</p>
                        <div className="grid grid-cols-2 gap-3">
                            {roleOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setRole(option.value as UserRole)}
                                    className={cn(
                                        'p-4 rounded-xl border-2 text-left transition-all',
                                        role === option.value
                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                            : 'border-[var(--border-color)] hover:border-[var(--neutral-300)]'
                                    )}
                                >
                                    <div className={cn(
                                        'w-10 h-10 rounded-full flex items-center justify-center mb-2',
                                        option.value === 'referee'
                                            ? 'bg-[var(--brand-green)]'
                                            : 'bg-[var(--brand-orange)]'
                                    )}>
                                        {option.value === 'referee' ? (
                                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className="font-semibold text-sm">{option.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        <Input
                            label="Full Name"
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="John Smith"
                            required
                        />

                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />

                        <Input
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            hint="At least 8 characters"
                            required
                        />

                        <Input
                            label="Phone (optional)"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="07700 900000"
                        />

                        <Input
                            label={role === 'referee' ? 'Home Postcode' : 'Club Postcode'}
                            type="text"
                            value={postcode}
                            onChange={(e) => setPostcode(e.target.value)}
                            placeholder="SW1A 1AA"
                            hint={role === 'referee' ? 'For matching with nearby games' : 'Your home ground postcode'}
                        />

                        <div className="pt-2">
                            <Button
                                type="submit"
                                fullWidth
                                loading={loading}
                                size="lg"
                            >
                                Create Account
                            </Button>
                        </div>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-[var(--foreground-muted)]">
                            Already have an account?{' '}
                            <Link href="/auth/login" className="text-[var(--color-primary)] font-medium hover:underline">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
