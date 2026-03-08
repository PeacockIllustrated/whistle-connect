'use client'

import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="text-center max-w-sm">
                <WifiOff className="w-16 h-16 mx-auto mb-4 text-[var(--neutral-300)]" />
                <h1 className="text-xl font-bold mb-2">You&apos;re Offline</h1>
                <p className="text-sm text-[var(--foreground-muted)] mb-6">
                    It looks like you&apos;ve lost your internet connection. Please check your network and try again.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2.5 bg-[var(--brand-primary)] text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                    Try Again
                </button>
            </div>
        </div>
    )
}
