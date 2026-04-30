/**
 * Server-side Sentry verification endpoint. Throws unconditionally so the
 * onRequestError instrumentation in src/instrumentation.ts can capture it.
 *
 * Visit /sentry-example-page in the browser and click "Trigger a server-side
 * error" to fire this. Safe to leave in production — it only throws when
 * called directly, and the event in Sentry will be tagged with this route
 * so it's obviously a test.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
    throw new Error('Sentry test — server-side error from /api/sentry-test')
}
