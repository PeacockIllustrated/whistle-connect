'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('App error boundary caught:', error)
    }, [error])

    return (
        <div className="px-4 py-12 max-w-[var(--content-max-width)] mx-auto text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-2xl">!</span>
            </div>
            <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">
                Something went wrong
            </h1>
            <p className="text-[var(--foreground-muted)] mb-6">
                There was a problem loading this page. Please try again.
            </p>
            <div className="flex items-center justify-center gap-3">
                <button
                    onClick={reset}
                    className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                    Try Again
                </button>
                <Link
                    href="/app"
                    className="px-5 py-2.5 border border-[var(--border-color)] rounded-lg font-medium text-[var(--foreground-muted)] hover:bg-[var(--background-soft)] transition-colors"
                >
                    Back to Dashboard
                </Link>
            </div>
        </div>
    )
}
