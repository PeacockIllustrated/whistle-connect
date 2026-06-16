'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { signUpGeneric } from '@/lib/auth/actions'
import { claimEntry } from '@/lib/world-cup/actions'

export function GenericSignupForm({ claimToken, prefillName, returnTo }: { claimToken?: string; prefillName?: string; returnTo: string }) {
    const [fullName, setFullName] = useState(prefillName ?? '')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [terms, setTerms] = useState(false)
    const [privacy, setPrivacy] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setMessage('')
        if (!terms || !privacy) return setError('Please accept the Terms and Privacy Policy to continue')

        setLoading(true)
        const result = await signUpGeneric(
            { email, password, full_name: fullName, terms_accepted: terms, privacy_accepted: privacy },
            returnTo,
        )

        if (result?.error) {
            setError(result.error)
            setLoading(false)
            return
        }
        if (result?.message) {
            // Email confirmation required - they'll claim their spot after confirming.
            setMessage(result.message)
            setLoading(false)
            return
        }

        // Logged in immediately. Attach their sweepstake spot if they came from one.
        if (claimToken) {
            await claimEntry(claimToken).catch(() => { /* best-effort */ })
        }
        window.location.href = result?.redirectTo || returnTo
    }

    return (
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" required />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" hint="At least 12 characters" required />

            <div className="space-y-3 pt-1">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--border-color)]" required />
                    <span className="text-sm leading-relaxed text-[var(--foreground-muted)]">
                        I agree to the{' '}
                        <Link href="/terms" target="_blank" className="font-medium text-[var(--color-primary)] hover:underline">Terms of Service</Link>.
                    </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--border-color)]" required />
                    <span className="text-sm leading-relaxed text-[var(--foreground-muted)]">
                        I agree to the{' '}
                        <Link href="/privacy" target="_blank" className="font-medium text-[var(--color-primary)] hover:underline">Privacy Policy</Link>.
                    </span>
                </label>
            </div>

            <Button type="submit" fullWidth loading={loading} disabled={!terms || !privacy} size="lg" variant="accent">
                Create account
            </Button>
        </form>
    )
}
