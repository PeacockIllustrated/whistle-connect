'use client'

import { useEffect } from 'react'

export default function RootError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Root error boundary caught:', error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
            <div className="text-center max-w-md">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-2xl">!</span>
                </div>
                <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
                    Something went wrong
                </h1>
                <p className="text-[var(--foreground-muted)] mb-6">
                    An unexpected error occurred. Please try again.
                </p>
                <button
                    onClick={reset}
                    className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                    Try Again
                </button>
            </div>
        </div>
    )
}
