'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { signIn } from '@/lib/auth/actions'
import { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

const roleOptions = [
    { value: 'coach', label: 'Coach / Club Manager' },
    { value: 'referee', label: 'Referee' },
]

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const returnTo = searchParams.get('returnTo') || '/app'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState<UserRole>('coach')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const result = await signIn(email, password, returnTo)
            if (result?.error) {
                setError(result.error)
            }
        } catch (err) {
            setError('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
            {/* Header */}
            <header className="bg-[var(--neutral-900)] text-white py-4 px-4">
                <div className="max-w-[var(--content-max-width)] mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <Image
                            src="/assets/logo-main-white.svg"
                            alt="Whistle Connect"
                            width={130}
                            height={45}
                            priority
                        />
                    </Link>
                    <span className="text-sm font-medium text-white/60">Sign In</span>
                </div>
            </header>

            {/* Form */}
            <main className="flex-1 flex flex-col justify-center px-4 py-8">
                <div className="max-w-[var(--content-max-width)] mx-auto w-full">
                    <div className="text-center mb-10">
                        <Image
                            src="/assets/icon-lightblue.svg"
                            alt="Whistle Connect"
                            width={56}
                            height={56}
                            className="mx-auto mb-6"
                        />
                        <h2 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">Welcome Back</h2>
                        <p className="text-[var(--foreground-muted)] mt-1">Sign in to your account</p>
                    </div>

                    {/* Role Selection */}
                    <div className="mb-8">
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

                    <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <Input
                            label="Email Address"
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
                            required
                        />

                        <div className="pt-2">
                            <Button
                                type="submit"
                                fullWidth
                                loading={loading}
                                size="lg"
                                className="shadow-lg"
                            >
                                Sign In
                            </Button>
                        </div>
                    </form>

                    <div className="mt-8 text-center border-t border-[var(--border-color)] pt-8">
                        <p className="text-[var(--foreground-muted)]">
                            Don&apos;t have an account?{' '}
                            <Link href={`/auth/register${returnTo !== '/app' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-[var(--brand-primary)] font-bold hover:underline">
                                Register Now
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
