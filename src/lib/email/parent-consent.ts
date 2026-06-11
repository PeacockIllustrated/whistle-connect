import { Resend } from 'resend'
import * as Sentry from '@sentry/nextjs'
import { sendViaMake } from './send'
import { parentalConsentHtml } from './templates'

/**
 * Parent / guardian consent email for under-18 referees. The app renders the
 * branded HTML (src/lib/email/templates.ts, compiled from
 * emails/parental-consent.mjml) and sends it via the Make hub as data.html;
 * Resend is the transition fallback when Make isn't configured. The account
 * stays locked (referee_profiles.parental_consent_status='awaiting') until the
 * parent approves via the one-click link, handled by /api/parent-consent.
 */

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

/**
 * Send the parental-consent email to the parent/guardian captured at signup.
 * Fire-and-forget at signup (best-effort) — the account stays locked
 * regardless, so a failed send is recoverable (admin resend is a follow-up).
 */
export async function sendParentConsentEmail({
    parentEmail,
    childName,
    responseToken,
}: {
    parentEmail: string
    childName: string
    responseToken: string
}): Promise<{ success: boolean; error?: string }> {
    const baseUrl = getBaseUrl()
    const approveUrl = `${baseUrl}/api/parent-consent?token=${responseToken}&action=approved`
    const declineUrl = `${baseUrl}/api/parent-consent?token=${responseToken}&action=rejected`
    const subject = `Parental consent needed for ${childName} on Whistle Connect`
    const html = parentalConsentHtml({ childName, approveUrl, declineUrl })

    // Prefer the Make email hub; Resend is the transition fallback.
    const viaMake = await sendViaMake({
        type: 'parental_consent',
        to: parentEmail,
        subject,
        data: { html },
    })
    if (viaMake === 'sent') return { success: true }

    try {
        const resend = getResend()
        const { error } = await resend.emails.send({
            from: 'Whistle Connect <onboarding@resend.dev>',
            to: [parentEmail],
            subject,
            html,
        })
        if (error) {
            console.error('Resend error (parent consent):', error)
            Sentry.captureException(error, { tags: { 'parent.email.send': 'failed' } })
            return { success: false, error: 'Failed to send email' }
        }
        return { success: true }
    } catch (err) {
        console.error('Parent consent email error:', err)
        Sentry.captureException(err, { tags: { 'parent.email.send': 'threw' } })
        return { success: false, error: String(err) }
    }
}
