import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/server'
import { sendViaMake } from './send'
import { faVerificationHtml, faVerificationActionHtml } from './templates'

/**
 * FA-number verification email to the County FA. Rendered in-app and sent via
 * the Make → Zoho hub (data.html). Make is the SOLE transport — no fallback;
 * a misconfigured hub is logged to Sentry. With a one-click token (admin
 * createFAVerificationRequest flow) the buttoned variant is used; without one
 * (signup / manual send) the reply-to-confirm variant is used.
 */

const FALLBACK_RECIPIENT = 'tom@onesignanddigital.com'

function getBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
    return 'http://localhost:3000'
}

async function resolveRecipient(county?: string | null): Promise<{ to: string; isFallback: boolean }> {
    if (!county) {
        Sentry.captureMessage('FA verification email falling back: no county on referee', {
            level: 'warning',
            tags: { 'fa.email.fallback': 'no-county' },
        })
        return { to: FALLBACK_RECIPIENT, isFallback: true }
    }

    const admin = createAdminClient()
    if (!admin) {
        Sentry.captureMessage('FA verification email falling back: SUPABASE_SERVICE_ROLE_KEY missing', {
            level: 'warning',
            tags: { 'fa.email.fallback': 'no-service-role' },
            extra: { county },
        })
        return { to: FALLBACK_RECIPIENT, isFallback: true }
    }

    const { data, error } = await admin
        .from('county_fa_contacts')
        .select('email')
        .eq('county_name', county)
        .maybeSingle()

    if (error || !data?.email) {
        Sentry.captureMessage('FA verification email falling back: county not in county_fa_contacts', {
            level: 'warning',
            tags: { 'fa.email.fallback': 'county-not-in-table' },
            extra: { county, error: error?.message },
        })
        return { to: FALLBACK_RECIPIENT, isFallback: true }
    }

    return { to: data.email, isFallback: false }
}

/**
 * Send an FA verification email to the County FA's registered address.
 * Looks up county_fa_contacts by county; falls back to FALLBACK_RECIPIENT
 * with a Sentry warning if the county is missing or not in the table.
 */
export async function sendFAVerificationEmail({
    refereeName,
    faId,
    county,
    responseToken,
}: {
    refereeName: string
    faId: string
    county?: string | null
    responseToken?: string | null
}): Promise<{ success: boolean; error?: string; recipient?: string; isFallback?: boolean }> {
    try {
        const { to, isFallback } = await resolveRecipient(county)
        const countyLabel = county || 'County FA'
        const subject = `FA Number Verification Request — ${refereeName} (${faId})`

        let html: string
        if (responseToken) {
            const baseUrl = getBaseUrl()
            // Both buttons link to the read-only confirmation page (not a
            // mutating endpoint). The page renders the request details plus
            // Confirm / Not found buttons that POST the actual decision — so an
            // email security scanner that prefetches the link only ever READS,
            // never resolves the request.
            const confirmPageUrl = `${baseUrl}/fa-verify/confirm?token=${responseToken}`
            html = faVerificationActionHtml({
                refereeName,
                faId,
                county: countyLabel,
                confirmUrl: confirmPageUrl,
                rejectUrl: confirmPageUrl,
            })
        } else {
            html = faVerificationHtml({ refereeName, faId, county: countyLabel })
        }

        const outcome = await sendViaMake({
            type: 'fa_verification',
            to,
            subject,
            data: { html },
        })
        if (outcome === 'sent') return { success: true, recipient: to, isFallback }

        console.error('[fa-verification] email not sent via Make hub:', outcome)
        Sentry.captureMessage('FA verification email not sent', {
            level: 'error',
            tags: { 'fa.email.send': outcome },
        })
        return { success: false, error: 'Failed to send email' }
    } catch (err) {
        console.error('FA verification email error:', err)
        Sentry.captureException(err, { tags: { 'fa.email.send': 'threw' } })
        return { success: false, error: String(err) }
    }
}
