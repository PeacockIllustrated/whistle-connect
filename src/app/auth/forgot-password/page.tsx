'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { requestPasswordReset } from '@/lib/auth/actions'
import { useRedirectIfAuthed } from '@/lib/hooks/useRedirectIfAuthed'

export default function ForgotPasswordPage() {
    const { checked } = useRedirectIfAuthed()
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setMessage('')
        setLoading(true)

        try {
            const result = await requestPasswordReset(email)
            if (result?.error) {
                setError(result.error)
            } else if (result?.message) {
                setMessage(result.message)
                setEmail('')
            }
        } catch {
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
                    <span className="text-sm font-medium text-white/60">Forgot Password</span>
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
                        <h2 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">Forgot Password?</h2>
                        <p className="text-[var(--foreground-muted)] mt-1">
                            Enter your email and we&apos;ll send you a link to reset it.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm font-medium">
                                {message}
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

                        <div className="pt-2">
                            <Button
                                type="submit"
                                fullWidth
                                loading={loading}
                                size="lg"
                                className="shadow-lg"
                            >
                                Send Reset Link
                            </Button>
                        </div>
                    </form>

                    <div className="mt-8 text-center border-t border-[var(--border-color)] pt-8">
                        <p className="text-[var(--foreground-muted)]">
                            Remembered your password?{' '}
                            <Link href="/auth/login" className="text-[var(--brand-primary)] font-bold hover:underline">
                                Back to Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
