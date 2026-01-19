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
    const returnTo = searchParams.get('returnTo') || '/app'
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
            }, returnTo)
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
                        <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--background-soft)] rounded-2xl border border-[var(--border-color)]">
                            {roleOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setRole(option.value as UserRole)}
                                    className={cn(
                                        'py-4 px-2 rounded-xl text-center transition-all duration-200 font-bold text-sm outline-none',
                                        role === option.value
                                            ? option.value === 'referee'
                                                ? 'bg-[var(--wc-red)] text-white shadow-lg'
                                                : 'bg-[var(--wc-blue)] text-white shadow-lg'
                                            : 'text-[var(--foreground-muted)] hover:bg-[var(--neutral-100)]'
                                    )}
                                >
                                    {option.label}
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
