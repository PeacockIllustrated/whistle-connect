'use client'

// Root error boundary — catches React render errors that escape the per-route
// error.tsx files. Required for Sentry to capture client-side render errors
// reliably in App Router.
//
// The user-visible UI is intentionally minimal: a render error here means
// something serious has gone wrong below the layout, and we want to fail
// loud rather than risk hiding it behind another faulty component.

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string }
}) {
    useEffect(() => {
        Sentry.captureException(error)
    }, [error])

    return (
        <html lang="en">
            <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '640px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Something went wrong</h1>
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                    The page failed to load. The team has been notified.
                </p>
                <a href="/app" style={{ color: '#1b2537', fontWeight: 600 }}>
                    Return to the app
                </a>
            </body>
        </html>
    )
}
