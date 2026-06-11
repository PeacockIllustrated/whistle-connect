import * as Sentry from '@sentry/nextjs'
import { sendViaMake } from './send'
import { parentalConsentHtml } from './templates'

/**
 * Parent / guardian consent email for under-18 referees. Rendered in-app and
 * sent via the Make → Zoho hub (data.html). Make is the SOLE transport — if the
 * hub isn't configured the send fails (logged to Sentry); there is no fallback.
 * The account stays locked (parental_consent_status='awaiting') until the parent
 * approves via /api/parent-consent, so a failed send is recoverable (admin resend).
 */

function getBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
    return 'http://localhost:3000'
}

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

    const outcome = await sendViaMake({
        type: 'parental_consent',
        to: parentEmail,
        subject,
        data: { html },
    })
    if (outcome === 'sent') return { success: true }

    console.error('[parent-consent] email not sent via Make hub:', outcome)
    Sentry.captureMessage('Parental consent email not sent', {
        level: 'error',
        tags: { 'parent.email.send': outcome },
    })
    return { success: false, error: 'Failed to send email' }
}
