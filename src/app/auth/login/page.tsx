'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { signIn } from '@/lib/auth/actions'
import { useRedirectIfAuthed } from '@/lib/hooks/useRedirectIfAuthed'
import { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

const roleOptions = [
    { value: 'coach', label: 'Coach / Club Manager' },
    { value: 'referee', label: 'Referee' },
]

export default function LoginPage() {
    const searchParams = useSearchParams()
    const returnTo = searchParams.get('returnTo') || '/app'
    const { checked } = useRedirectIfAuthed(returnTo)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState<UserRole>('coach')
    const [error, setError] = useState(searchParams.get('error') || '')
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
            // Next.js redirect() throws a special error — let it propagate
            if (err && typeof err === 'object' && 'digest' in err) throw err
            setError('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    if (!checked) return null

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
            <form
                onSubmit={handleSubmit}
                autoComplete="off"
                className="flex-1 flex flex-col px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]"
            >
                <div className="max-w-[var(--content-max-width)] mx-auto w-full">
                    <div className="text-center mb-8">
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

                    <div className="space-y-4">
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

                        <div className="flex justify-end">
                            <Link
                                href="/auth/forgot-password"
                                className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
                            >
                                Forgot password?
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Bottom-anchored CTA — kept in the thumb zone */}
                <div className="max-w-[var(--content-max-width)] mx-auto w-full mt-auto pt-8">
                    <Button
                        type="submit"
                        fullWidth
                        loading={loading}
                        size="lg"
                        className="shadow-lg"
                    >
                        Sign In
                    </Button>
                    <p className="text-[var(--foreground-muted)] text-center mt-5">
                        Don&apos;t have an account?{' '}
                        <Link
                            href={`/auth/register${returnTo !== '/app' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                            className="text-[var(--brand-primary)] font-bold hover:underline"
                        >
                            Register Now
                        </Link>
                    </p>
                </div>
            </form>
        </div>
    )
}
