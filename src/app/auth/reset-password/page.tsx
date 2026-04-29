'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updatePassword } from '@/lib/auth/actions'
import { createClient } from '@/lib/supabase/client'

type SessionState = 'checking' | 'valid' | 'missing'

export default function ResetPasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const [sessionState, setSessionState] = useState<SessionState>('checking')

    // Validate that the user actually arrived here via a recovery link
    // (i.e. has an active Supabase session set by /auth/callback). Bare
    // URL access shows a clear "expired link" message instead of a form
    // that only fails on submit.
    useEffect(() => {
        let cancelled = false
        const supabase = createClient()
        supabase.auth.getUser().then(({ data }) => {
            if (cancelled) return
            setSessionState(data.user ? 'valid' : 'missing')
        })
        return () => { cancelled = true }
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setLoading(true)

        try {
            const result = await updatePassword(password)
            if (result?.error) {
                setError(result.error)
            } else {
                setSuccess(true)
                setTimeout(() => router.push('/auth/login'), 2000)
            }
        } catch {
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
                    <span className="text-sm font-medium text-white/60">Reset Password</span>
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
                        <h2 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">Choose a New Password</h2>
                        <p className="text-[var(--foreground-muted)] mt-1">Enter and confirm your new password below.</p>
                    </div>

                    {sessionState === 'checking' && (
                        <div className="p-4 bg-[var(--background-soft)] border border-[var(--border-color)] rounded-xl text-[var(--foreground-muted)] text-sm font-medium text-center">
                            Verifying your reset link…
                        </div>
                    )}

                    {sessionState === 'missing' && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium text-center space-y-3">
                            <p>This reset link has expired or is invalid.</p>
                            <Link
                                href="/auth/forgot-password"
                                className="inline-block px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-sm transition-colors"
                            >
                                Request a new link
                            </Link>
                        </div>
                    )}

                    {sessionState === 'valid' && success && (
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm font-medium text-center">
                            Password updated successfully. Redirecting you to sign in…
                        </div>
                    )}

                    {sessionState === 'valid' && !success && (
                        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            <Input
                                label="New Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                hint="Must be at least 8 characters"
                                required
                            />

                            <Input
                                label="Confirm New Password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
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
                                    Update Password
                                </Button>
                            </div>
                        </form>
                    )}

                    <div className="mt-8 text-center border-t border-[var(--border-color)] pt-8">
                        <p className="text-[var(--foreground-muted)]">
                            Back to{' '}
                            <Link href="/auth/login" className="text-[var(--brand-primary)] font-bold hover:underline">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
