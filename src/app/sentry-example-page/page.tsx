'use client'

/**
 * Sentry verification page. Use to confirm both client-side AND server-side
 * Sentry capture are working after a deploy. NOT linked from anywhere in the
 * app — visit /sentry-example-page directly. Safe to leave in production:
 * the page does nothing until a button is clicked, and only authenticated
 * Sentry dashboard users will see the resulting event.
 */

import { useState } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function SentryExamplePage() {
    const [serverResult, setServerResult] = useState<string | null>(null)

    async function triggerClientError() {
        // Throws synchronously — caught by Sentry's automatic global handler.
        throw new Error('Sentry test — client-side error from /sentry-example-page')
    }

    async function triggerCapturedError() {
        // Sent explicitly via Sentry.captureException so we can verify the
        // SDK is initialised (DSN reachable, sendDefaultPii applied, etc.).
        try {
            throw new Error('Sentry test — captureException from /sentry-example-page')
        } catch (err) {
            Sentry.captureException(err)
            alert('Captured. Check Sentry → Issues for the event within ~30s.')
        }
    }

    async function triggerServerError() {
        setServerResult('Calling /api/sentry-test...')
        try {
            const res = await fetch('/api/sentry-test')
            setServerResult(`Server returned ${res.status}. Check Sentry → Issues for the server-side event.`)
        } catch (err) {
            setServerResult(`Fetch failed: ${(err as Error).message}`)
        }
    }

    return (
        <main className="min-h-screen bg-[var(--neutral-50)] p-6">
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-6 space-y-5">
                <div>
                    <h1 className="text-xl font-bold mb-1">Sentry verification</h1>
                    <p className="text-sm text-[var(--foreground-muted)]">
                        Each button fires a different kind of error. After clicking, open
                        your Sentry project &rarr; Issues. Events typically appear within 30
                        seconds.
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={triggerCapturedError}
                        className="w-full rounded-xl bg-[var(--brand-primary)] text-white font-semibold py-3 text-sm hover:opacity-90"
                    >
                        Send a captured client error
                    </button>
                    <p className="text-xs text-[var(--foreground-muted)]">
                        Calls Sentry.captureException directly. Best smoke test.
                    </p>

                    <button
                        onClick={triggerClientError}
                        className="w-full rounded-xl bg-amber-500 text-white font-semibold py-3 text-sm hover:opacity-90"
                    >
                        Throw an unhandled client error
                    </button>
                    <p className="text-xs text-[var(--foreground-muted)]">
                        Verifies the global error handler is wired up.
                    </p>

                    <button
                        onClick={triggerServerError}
                        className="w-full rounded-xl bg-red-600 text-white font-semibold py-3 text-sm hover:opacity-90"
                    >
                        Trigger a server-side error
                    </button>
                    <p className="text-xs text-[var(--foreground-muted)]">
                        Hits /api/sentry-test which throws. Verifies onRequestError is wired up.
                    </p>
                    {serverResult && (
                        <p className="text-xs mt-2 p-2 bg-[var(--neutral-100)] rounded">{serverResult}</p>
                    )}
                </div>
            </div>
        </main>
    )
}
