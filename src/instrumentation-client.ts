// Sentry init for the browser bundle. Captures unhandled errors and unhandled
// promise rejections automatically. Skips Replay and Logs for now — errors
// only, MVP scope.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Send request headers + user IP — helpful for narrowing client-side
    // errors to a specific user / device.
    sendDefaultPii: true,

    // Tracing sample rate — light in production.
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

    // Tag events with the deploy environment.
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
})
