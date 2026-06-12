'use client'

import { useConsent } from './ConsentProvider'

/**
 * Persistent entry point to re-open the cookie banner so users can change or
 * withdraw consent at any time (required for compliance). Styled by the caller.
 */
export function CookieSettingsLink({ className }: { className?: string }) {
    const { openManager } = useConsent()
    return (
        <button type="button" onClick={openManager} className={className}>
            Cookie settings
        </button>
    )
}
