import { Resend } from 'resend'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/server'
import { sendViaMake } from './send'
import { faVerificationHtml, faVerificationActionHtml } from './templates'

/**
 * FA-number verification email to the County FA. The app renders the branded
 * HTML (src/lib/email/templates.ts, compiled from emails/fa-verification*.mjml)
 * and sends it via the Make hub as data.html; Resend is the transition fallback.
 * With a one-click token (admin createFAVerificationRequest flow) the buttoned
 * variant is used; without one (signup / manual send) the reply-to-confirm
 * variant is used.
 */

const FALLBACK_RECIPIENT = 'tom@onesignanddigital.com'

function getResend() {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY not configured')
    return new Resend(apiKey)
}

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
            html = faVerificationActionHtml({
                refereeName,
                faId,
                county: countyLabel,
                confirmUrl: `${baseUrl}/api/fa-verify?token=${responseToken}&action=confirmed`,
                rejectUrl: `${baseUrl}/api/fa-verify?token=${responseToken}&action=rejected`,
            })
        } else {
            html = faVerificationHtml({ refereeName, faId, county: countyLabel })
        }

        // Prefer the Make email hub; Resend is the transition fallback.
        const viaMake = await sendViaMake({
            type: 'fa_verification',
            to,
            subject,
            data: { html },
        })
        if (viaMake === 'sent') return { success: true, recipient: to, isFallback }

        const resend = getResend()
        const { error } = await resend.emails.send({
            from: 'Whistle Connect <onboarding@resend.dev>',
            to: [to],
            subject,
            html,
        })

        if (error) {
            console.error('Resend error:', error)
            Sentry.captureException(error, { tags: { 'fa.email.send': 'failed' } })
            return { success: false, error: 'Failed to send email' }
        }

        return { success: true, recipient: to, isFallback }
    } catch (err) {
        console.error('FA verification email error:', err)
        Sentry.captureException(err, { tags: { 'fa.email.send': 'threw' } })
        return { success: false, error: String(err) }
    }
}
