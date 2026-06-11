'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck } from 'lucide-react'
import { claimEntry } from '@/lib/world-cup/actions'

/**
 * "This is me" - lets a viewer attach their account to an unclaimed spot. Logged
 * out, it routes through the generic signup (the growth funnel). Logged in, it
 * claims directly.
 */
export function ClaimPanel({
    shareId,
    entries,
    isLoggedIn,
}: {
    shareId: string
    entries: { token: string; name: string }[]
    isLoggedIn: boolean
}) {
    const router = useRouter()
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState('')

    async function claim(token: string, name: string) {
        setError('')
        if (!isLoggedIn) {
            // Not signed in: send them to a quick sign-up with their name + spot
            // carried through, so the account is created and the spot claimed in
            // one smooth step.
            const returnTo = `/world-cup/s/${shareId}`
            const params = new URLSearchParams({ claim: token, name, returnTo })
            router.push(`/world-cup/signup?${params.toString()}`)
            return
        }
        setBusy(token)
        const res = await claimEntry(token)
        setBusy(null)
        if (res?.error) return setError(res.error)
        router.refresh()
    }

    return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-color)] bg-[var(--background-soft)] p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <UserCheck className="h-4 w-4 text-[var(--wc-blue)]" /> One of these you?
            </h2>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                {isLoggedIn
                    ? 'Claim your spot to follow your teams, and unlock the full Whistle Connect app.'
                    : 'Tap your name to create a free account and lock in your spot. Takes a few seconds.'}
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
                {entries.map((e) => (
                    <button
                        key={e.token}
                        onClick={() => claim(e.token, e.name)}
                        disabled={busy === e.token}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--wc-blue)] disabled:opacity-50"
                    >
                        {e.name}
                    </button>
                ))}
            </div>
        </div>
    )
}
