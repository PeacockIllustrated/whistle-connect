// Sentry init for the Edge runtime (middleware, edge route handlers).
// Smaller surface than the server config — no PII, just errors.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
})
