'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PrivacyToggleRowProps {
    label: string
    value: string | null
    className?: string
}

export function PrivacyToggleRow({ label, value, className }: PrivacyToggleRowProps) {
    const [isVisible, setIsVisible] = useState(false)

    const maskedValue = value ? '*'.repeat(value.length) : 'Not set'
    const displayValue = !value ? 'Not set' : (isVisible ? value : maskedValue)

    return (
        <div className={`flex justify-between items-center py-2 border-b border-[var(--border-color)] last:border-0 ${className}`}>
            <span className="text-sm text-[var(--foreground-muted)]">{label}</span>
            <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${!isVisible && value ? 'tracking-wider' : ''}`}>
                    {displayValue}
                </span>
                {value && (
                    <button
                        onClick={() => setIsVisible(!isVisible)}
                        className="p-1 hover:bg-[var(--neutral-100)] rounded-md transition-colors text-[var(--neutral-400)] hover:text-[var(--foreground)]"
                        title={isVisible ? "Hide" : "Show"}
                    >
                        {isVisible ? (
                            <EyeOff className="w-4 h-4" />
                        ) : (
                            <Eye className="w-4 h-4" />
                        )}
                    </button>
                )}
            </div>
        </div>
    )
}
