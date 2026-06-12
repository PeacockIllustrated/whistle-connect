// Cookie-consent + Google Analytics configuration and low-level cookie helpers.
//
// Compliance stance (UK GDPR + PECR, platform has under-18 users):
//   - Analytics is a NON-ESSENTIAL cookie category. It is OFF by default and
//     only loads after explicit opt-in (banner "Accept" or the optional signup
//     tick box). No Google script or cookie is loaded until then.
//   - Consent is withdrawable; withdrawing deletes GA cookies and disables GA.
//
// The Measurement ID is a PUBLIC value (it ships in the client bundle anyway).
// Override per-environment with NEXT_PUBLIC_GA_ID if desired.

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-5448PJ2D44'

export const CONSENT_COOKIE = 'wc-analytics-consent'
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180 // 180 days

export type ConsentValue = 'granted' | 'denied'

export function readConsentCookie(): ConsentValue | null {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp('(?:^|; )' + CONSENT_COOKIE + '=([^;]*)'))
    const value = match ? decodeURIComponent(match[1]) : null
    return value === 'granted' || value === 'denied' ? value : null
}

export function writeConsentCookie(value: ConsentValue) {
    if (typeof document === 'undefined') return
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}

// Best-effort removal of GA's own cookies (_ga, _ga_<id>, _gid, _gat) across the
// host and registrable domain, used when consent is withdrawn.
export function clearGaCookies() {
    if (typeof document === 'undefined') return
    const names = document.cookie
        .split('; ')
        .map((c) => c.split('=')[0])
        .filter((n) => /^_ga/.test(n) || n === '_gid' || /^_gat/.test(n))
    const host = location.hostname
    const registrable = host.split('.').slice(-2).join('.')
    const domains = [undefined, host, '.' + host, registrable, '.' + registrable]
    for (const n of names) {
        for (const d of domains) {
            document.cookie = `${n}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT${d ? `; Domain=${d}` : ''}`
        }
    }
}
