import { Resend } from 'resend'
import * as Sentry from '@sentry/nextjs'
import { escapeHtml } from '@/lib/utils'
import { sendViaMake } from './send'

/**
 * Parent / guardian consent email for under-18 referees. Mirrors the FA
 * verification pattern (src/lib/email/fa-verification.ts): a one-click token
 * link, no login required, handled by /api/parent-consent. The referee's
 * account stays locked (referee_profiles.parental_consent_status='awaiting')
 * until the parent approves.
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

function buildConsentEmail({
    childName,
    responseToken,
}: {
    childName: string
    responseToken: string
}): string {
    const year = new Date().getFullYear()
    const safeChild = escapeHtml(childName)
    const baseUrl = getBaseUrl()
    const approveUrl = `${baseUrl}/api/parent-consent?token=${responseToken}&action=approved`
    const declineUrl = `${baseUrl}/api/parent-consent?token=${responseToken}&action=rejected`

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parental Consent Required</title>
  <style>
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    a { text-decoration: none; color: inherit; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 20px !important; }
      .btn-cell { display: block !important; width: 100% !important; padding: 4px 0 !important; }
    }
  </style>
</head>
<body style="background-color: #f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <tr>
            <td align="center" style="background-color: #1d2557; padding: 32px 40px;">
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0; letter-spacing: 0.5px;">WHISTLE CONNECT</h1>
              <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 8px 0 0 0;">FA Referee Management</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1d2557; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 8px;">Parental Consent Required</h2>

              <p style="margin-bottom: 16px; color: #475569; font-size: 15px;">Dear Parent or Guardian,</p>

              <p style="margin-bottom: 16px; color: #475569; font-size: 15px;">
                <strong>${safeChild}</strong> has registered as a referee on Whistle Connect.
                Because they are under 18, we need a parent or guardian to confirm consent
                before the account can be used.
              </p>

              <p style="margin-bottom: 8px; color: #475569; font-size: 15px;">By approving, you confirm:</p>
              <ul style="margin: 0 0 24px 0; padding-left: 20px; color: #475569; font-size: 15px;">
                <li>You are the parent or legal guardian of ${safeChild}.</li>
                <li>You consent to the creation and use of this referee account.</li>
                <li>You have read the
                  <a href="${baseUrl}/terms" style="color: #1d2557; font-weight: 600;">Terms of Service</a> and
                  <a href="${baseUrl}/privacy" style="color: #1d2557; font-weight: 600;">Privacy Policy</a>.
                </li>
              </ul>

              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 8px 0 24px 0;">
                <tr>
                  <td align="center" class="btn-cell" style="padding-right: 8px;" width="50%">
                    <a href="${approveUrl}" style="background-color: #16a34a; color: #ffffff; padding: 14px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; display: block; text-align: center;">&#10003; Approve account</a>
                  </td>
                  <td align="center" class="btn-cell" style="padding-left: 8px;" width="50%">
                    <a href="${declineUrl}" style="background-color: #dc2626; color: #ffffff; padding: 14px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; display: block; text-align: center;">&#10007; Decline</a>
                  </td>
                </tr>
              </table>

              <p style="margin-bottom: 24px; color: #94a3b8; font-size: 13px; text-align: center;">
                One click &mdash; no login or account required.
              </p>

              <p style="margin-bottom: 0; color: #475569; font-size: 14px;">
                If you did not expect this email, please ignore it &mdash; the account stays
                locked and cannot be used without your approval.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${year} Whistle Connect. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Send the parental-consent email to the parent/guardian address captured at
 * signup. Fire-and-forget at signup (best-effort) — the account remains
 * locked regardless, so a failed send is recoverable (resend is a follow-up).
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
    try {
        // Prefer the Make email hub when configured; Resend is the transition
        // fallback (removable once Make is verified live).
        const baseUrl = getBaseUrl()
        const approveUrl = `${baseUrl}/api/parent-consent?token=${responseToken}&action=approved`
        const declineUrl = `${baseUrl}/api/parent-consent?token=${responseToken}&action=rejected`
        const viaMake = await sendViaMake({
            type: 'parental_consent',
            to: parentEmail,
            subject: `Parental consent needed for ${childName} on Whistle Connect`,
            data: { childName, approveUrl, declineUrl },
        })
        if (viaMake === 'sent') return { success: true }

        const resend = getResend()
        const html = buildConsentEmail({ childName, responseToken })

        const { error } = await resend.emails.send({
            from: 'Whistle Connect <onboarding@resend.dev>',
            to: [parentEmail],
            subject: `Parental consent needed for ${childName} on Whistle Connect`,
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
