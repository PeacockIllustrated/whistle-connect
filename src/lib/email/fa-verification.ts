import { Resend } from 'resend'
import { escapeHtml } from '@/lib/utils'

// Override recipient for testing — swap to countyEmail for production
const TEST_RECIPIENT = 'tom@onesignanddigital.com'

function getResend() {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY not configured')
    return new Resend(apiKey)
}

function getBaseUrl(): string {
    // Vercel deployment URL
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
    return 'http://localhost:3000'
}

function buildVerificationEmail({
    refereeName,
    faId,
    county,
    responseToken,
}: {
    refereeName: string
    faId: string
    county?: string | null
    responseToken?: string | null
}): string {
    const year = new Date().getFullYear()
    // Escape all user-supplied values before inserting into HTML
    const safeRefereeName = escapeHtml(refereeName)
    const safeFaId = escapeHtml(faId)
    const safeCounty = escapeHtml(county || 'County')
    const greeting = county ? `Dear ${safeCounty} Football Association,` : 'Dear Football Association,'
    const baseUrl = getBaseUrl()

    // Build one-click response buttons if we have a token
    const hasButtons = !!responseToken
    const confirmUrl = hasButtons ? `${baseUrl}/api/fa-verify?token=${responseToken}&action=confirmed` : ''
    const rejectUrl = hasButtons ? `${baseUrl}/api/fa-verify?token=${responseToken}&action=rejected` : ''

    const buttonsHtml = hasButtons ? `
              <!-- Response Buttons -->
              <p style="margin-bottom: 16px; color: #475569; font-size: 15px;">
                Please use one of the buttons below to confirm or deny this registration:
              </p>

              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="padding-right: 8px;" width="50%">
                    <a href="${confirmUrl}" style="background-color: #16a34a; color: #ffffff; padding: 14px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none; display: block; text-align: center; mso-padding-alt: 0;">
                      <!--[if mso]>
                      <i style="letter-spacing: 15px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i>
                      <![endif]-->
                      <span style="mso-text-raise: 15pt;">&#10003; Confirm Registration</span>
                      <!--[if mso]>
                      <i style="letter-spacing: 15px; mso-font-width: -100%;">&nbsp;</i>
                      <![endif]-->
                    </a>
                  </td>
                  <td align="center" style="padding-left: 8px;" width="50%">
                    <a href="${rejectUrl}" style="background-color: #dc2626; color: #ffffff; padding: 14px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none; display: block; text-align: center; mso-padding-alt: 0;">
                      <!--[if mso]>
                      <i style="letter-spacing: 15px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i>
                      <![endif]-->
                      <span style="mso-text-raise: 15pt;">&#10007; Not Found</span>
                      <!--[if mso]>
                      <i style="letter-spacing: 15px; mso-font-width: -100%;">&nbsp;</i>
                      <![endif]-->
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin-bottom: 24px; color: #94a3b8; font-size: 13px; text-align: center;">
                Just one click &mdash; no login or account required.
              </p>
    ` : `
              <p style="margin-bottom: 24px; color: #475569; font-size: 15px;">
                Please reply to this email to confirm or deny the validity of this registration. A simple confirmation is sufficient &mdash; we understand your time is valuable.
              </p>
    `

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FA Number Verification Request</title>
  <style>
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { text-decoration: none; color: inherit; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 20px !important; }
      .detail-table { width: 100% !important; }
      .btn-cell { display: block !important; width: 100% !important; padding: 4px 0 !important; }
    }
  </style>
</head>
<body style="background-color: #f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 0;">

        <!-- Email Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td align="center" style="background-color: #1d2557; padding: 32px 40px;">
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0; letter-spacing: 0.5px;">WHISTLE CONNECT</h1>
              <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 8px 0 0 0; letter-spacing: 0.3px;">FA Referee Management</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1d2557; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 8px;">FA Number Verification Request</h2>

              <p style="margin-bottom: 24px; color: #475569; font-size: 15px;">
                ${greeting}
              </p>

              <p style="margin-bottom: 24px; color: #475569; font-size: 15px;">
                We are writing to request verification of a referee registered on the Whistle Connect platform. We would be grateful if you could confirm whether the following FA registration number is valid and currently active.
              </p>

              <!-- Details Table -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" class="detail-table" style="margin: 28px 0; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="background-color: #f8fafc; padding: 14px 20px; border-bottom: 1px solid #e2e8f0; width: 140px;">
                    <span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Referee Name</span>
                  </td>
                  <td style="background-color: #ffffff; padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 15px; font-weight: 600; color: #1e293b;">${safeRefereeName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">FA Number</span>
                  </td>
                  <td style="background-color: #ffffff; padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 15px; font-weight: 600; color: #1d2557; font-family: 'Courier New', Courier, monospace; letter-spacing: 1px;">${safeFaId}</span>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f8fafc; padding: 14px 20px;">
                    <span style="font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">County FA</span>
                  </td>
                  <td style="background-color: #ffffff; padding: 14px 20px;">
                    <span style="font-size: 15px; font-weight: 600; color: #1e293b;">${safeCounty}</span>
                  </td>
                </tr>
              </table>

              ${buttonsHtml}

              <p style="margin-bottom: 0; color: #475569; font-size: 15px;">
                Many thanks for your assistance,
              </p>
              <p style="margin-top: 4px; color: #1d2557; font-size: 15px; font-weight: 600;">
                The Whistle Connect Team
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 0;" />
            </td>
          </tr>

          <!-- About Section -->
          <tr>
            <td style="padding: 24px 40px;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">
                Whistle Connect is a grassroots football referee management platform that connects coaches with qualified match officials. We verify all referee credentials to maintain the highest standards of safety and professionalism in grassroots football.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                &copy; ${year} Whistle Connect. All rights reserved.
              </p>
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
 * Send an FA verification email.
 * Used both at signup (no county yet) and by admin (with county).
 * When responseToken is provided, the email includes one-click Confirm/Reject buttons.
 * All emails go to TEST_RECIPIENT for now.
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
}): Promise<{ success: boolean; error?: string }> {
    try {
        const resend = getResend()
        const html = buildVerificationEmail({ refereeName, faId, county, responseToken })

        const { error } = await resend.emails.send({
            from: 'Whistle Connect <onboarding@resend.dev>',
            to: [TEST_RECIPIENT],
            subject: `FA Number Verification Request — ${refereeName} (${faId})`,
            html,
        })

        if (error) {
            console.error('Resend error:', error)
            return { success: false, error: 'Failed to send email' }
        }

        return { success: true }
    } catch (err) {
        console.error('FA verification email error:', err)
        return { success: false, error: String(err) }
    }
}
