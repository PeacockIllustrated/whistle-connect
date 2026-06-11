import 'server-only'
import * as Sentry from '@sentry/nextjs'

/**
 * Transactional email transport via the Make "email hub" webhook.
 *
 * Account-agnostic by design: the webhook URL + shared secret come from env
 * (MAKE_EMAIL_WEBHOOK_URL / MAKE_WEBHOOK_SECRET), so pointing the app at a new
 * Make.com account is a config change, not a code change. The app resolves the
 * recipient and builds any action URLs, then POSTs a small structured payload;
 * the Make scenario owns the templating and delivery. See docs/make-email-hub.md.
 */

/** Every transactional email the app can emit — one branch per type in Make. */
export type TransactionalEmailType =
    | 'parental_consent'
    | 'fa_verification'
    | 'welcome_referee'
    | 'welcome_coach'
    | 'booking_confirmed'
    | 'payment_received'
    | 'dispute_opened'

export interface SendEmailInput {
    type: TransactionalEmailType
    /** Resolved recipient address (the app does any lookup, not Make). */
    to: string
    /** Optional subject hint; Make may override with its own template. */
    subject?: string
    /** Type-specific fields the Make branch renders into the email. */
    data: Record<string, unknown>
}

export type MakeSendOutcome = 'sent' | 'not_configured' | 'error'

/**
 * POST an email to the Make hub when configured.
 *   'sent'           — Make accepted it; it owns delivery from here.
 *   'not_configured' — no MAKE_EMAIL_WEBHOOK_URL set; caller should fall back.
 *   'error'          — configured but the POST failed; caller may fall back.
 * Never throws.
 */
export async function sendViaMake(input: SendEmailInput): Promise<MakeSendOutcome> {
    const url = process.env.MAKE_EMAIL_WEBHOOK_URL
    if (!url) {
        console.error(`[email] MAKE_EMAIL_WEBHOOK_URL not set — "${input.type}" NOT sent`)
        Sentry.captureMessage('MAKE_EMAIL_WEBHOOK_URL not configured — transactional email not sent', {
            level: 'error',
            tags: { 'email.transport': 'make', 'email.type': input.type, 'email.failure': 'not-configured' },
        })
        return 'not_configured'
    }

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.MAKE_WEBHOOK_SECRET
                    ? { 'x-wc-email-secret': process.env.MAKE_WEBHOOK_SECRET }
                    : {}),
            },
            body: JSON.stringify({
                type: input.type,
                to: input.to,
                subject: input.subject ?? null,
                data: input.data,
                sentAt: new Date().toISOString(),
            }),
        })

        if (!res.ok) {
            console.error(`[email] Make webhook returned ${res.status} for "${input.type}"`)
            Sentry.captureMessage('Make email webhook returned non-2xx', {
                level: 'warning',
                tags: { 'email.transport': 'make', 'email.type': input.type },
                extra: { status: res.status },
            })
            return 'error'
        }
        return 'sent'
    } catch (err) {
        console.error('[email] Make webhook POST failed:', err)
        Sentry.captureException(err, {
            tags: { 'email.transport': 'make', 'email.type': input.type },
        })
        return 'error'
    }
}
