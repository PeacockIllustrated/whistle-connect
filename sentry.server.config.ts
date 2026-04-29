// Sentry init for the Node.js server runtime (server actions, route handlers,
// instrumentation registration). Imported by src/instrumentation.ts.
//
// If NEXT_PUBLIC_SENTRY_DSN is unset (e.g. local dev without Sentry), the SDK
// silently no-ops — calls to Sentry.captureException are safe regardless.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Send request headers + IP — useful for narrowing webhook / wallet
    // failures to a specific event.id or user.
    sendDefaultPii: true,

    // Sample rate for tracing — keep low in production, full in dev.
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

    // Don't tag events as 'production' on Vercel preview deploys.
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

    // Trim stack frames from node_modules — keeps issue grouping focused
    // on our code rather than framework internals.
    beforeSend(event) {
        return event
    },
})
