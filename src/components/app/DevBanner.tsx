'use client'

import { useState } from 'react'

export function DevBanner() {
    const [dismissed, setDismissed] = useState(false)

    if (dismissed) return null

    return (
        <div
            onClick={() => setDismissed(true)}
            className="fixed top-[var(--header-height)] left-0 right-0 z-40 overflow-hidden bg-[var(--wc-blue)]/95 backdrop-blur-sm cursor-pointer transition-opacity duration-300 hover:opacity-80"
        >
            <div className="dev-banner-scroll flex whitespace-nowrap py-1">
                {Array.from({ length: 4 }).map((_, i) => (
                    <span key={i} className="inline-flex items-center gap-6 px-6 text-[11px] font-semibold tracking-widest uppercase text-white/90">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                            In Development
                        </span>
                        <span className="text-white/50">/</span>
                        <span>Preview Build</span>
                        <span className="text-white/50">/</span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                            In Development
                        </span>
                        <span className="text-white/50">/</span>
                        <span>Preview Build</span>
                        <span className="text-white/50 pl-6">/</span>
                    </span>
                ))}
            </div>
        </div>
    )
}
