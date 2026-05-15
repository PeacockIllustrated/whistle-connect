/**
 * Sentry verification page. Confirms client + server Sentry capture after a
 * deploy. Not linked from anywhere — visit /sentry-example-page directly.
 *
 * Gated behind SENTRY_TEST_ROUTES_ENABLED: returns 404 unless the env var is
 * exactly 'true'. Set it in Vercel Production when verifying, then unset it.
 * Pairs with the same gate on /api/sentry-test.
 */

import { notFound } from 'next/navigation'
import SentryExampleClient from './SentryExampleClient'

export const dynamic = 'force-dynamic'

export default function SentryExamplePage() {
    if (process.env.SENTRY_TEST_ROUTES_ENABLED !== 'true') {
        notFound()
    }
    return <SentryExampleClient />
}
