'use client'

import { createContext, useCallback, useContext, useState, useSyncExternalStore } from 'react'
import {
    type ConsentValue,
    readConsentCookie,
    writeConsentCookie,
    clearGaCookies,
    GA_MEASUREMENT_ID,
} from '@/lib/consent/config'

// Tiny external store so the cookie value can be read SSR-safely via
// useSyncExternalStore (no setState-in-effect, no cascading renders).
const listeners = new Set<() => void>()
function subscribe(cb: () => void) {
    listeners.add(cb)
    return () => listeners.delete(cb)
}
function emitChange() {
    listeners.forEach((l) => l())
}
const serverConsent = () => null
// "Hydrated" flag: false on the server, true after the client mounts. Lets the
// banner stay out of the SSR HTML so already-decided users never see a flash.
const noopSubscribe = () => () => {}
const clientTrue = () => true
const serverFalse = () => false

interface ConsentContextValue {
    /** Current decision, or null if the user hasn't chosen yet. */
    consent: ConsentValue | null
    /** True once mounted on the client (avoids an SSR banner flash). */
    ready: boolean
    /** Record a decision (also fires Consent Mode update + GA cookie cleanup). */
    setConsent: (value: ConsentValue) => void
    /** Re-open the banner so the user can change/withdraw consent. */
    openManager: () => void
    /** Whether the user explicitly re-opened the banner to manage preferences. */
    managerOpen: boolean
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function ConsentProvider({ children }: { children: React.ReactNode }) {
    const consent = useSyncExternalStore(subscribe, readConsentCookie, serverConsent)
    const ready = useSyncExternalStore(noopSubscribe, clientTrue, serverFalse)
    const [managerOpen, setManagerOpen] = useState(false)

    const setConsent = useCallback((value: ConsentValue) => {
        writeConsentCookie(value)
        setManagerOpen(false)

        if (typeof window !== 'undefined') {
            // Google Consent Mode v2 signal (no-op if gtag isn't loaded yet — the
            // GoogleAnalytics component reads `consent` and only mounts when granted).
            window.gtag?.('consent', 'update', {
                analytics_storage: value === 'granted' ? 'granted' : 'denied',
            })
            if (value === 'denied') {
                // Hard kill-switch GA recognises, plus remove any cookies it set.
                ;(window as unknown as Record<string, boolean>)[`ga-disable-${GA_MEASUREMENT_ID}`] = true
                clearGaCookies()
            } else {
                ;(window as unknown as Record<string, boolean>)[`ga-disable-${GA_MEASUREMENT_ID}`] = false
            }
        }

        emitChange() // re-read the cookie in all subscribed components
    }, [])

    return (
        <ConsentContext.Provider
            value={{
                consent,
                ready,
                setConsent,
                openManager: () => setManagerOpen(true),
                managerOpen,
            }}
        >
            {children}
        </ConsentContext.Provider>
    )
}

export function useConsent() {
    const ctx = useContext(ConsentContext)
    if (!ctx) throw new Error('useConsent must be used within a ConsentProvider')
    return ctx
}
