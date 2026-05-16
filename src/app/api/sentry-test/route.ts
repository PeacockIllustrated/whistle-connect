/**
 * Server-side Sentry verification endpoint. Throws so the onRequestError
 * instrumentation in src/instrumentation.ts can capture it.
 *
 * Gated behind SENTRY_TEST_ROUTES_ENABLED — returns 404 unless the env var is
 * exactly 'true'. Set it in Vercel Production when you want to verify Sentry
 * after a deploy (via /sentry-example-page), then unset it.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
    if (process.env.SENTRY_TEST_ROUTES_ENABLED !== 'true') {
        return new Response('Not found', { status: 404 })
    }
    throw new Error('Sentry test — server-side error from /api/sentry-test')
}
