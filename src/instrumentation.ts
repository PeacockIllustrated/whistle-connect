// Next.js instrumentation hook — registers the appropriate Sentry runtime
// init when the server boots. App Router native API (Next 13+).
//
// onRequestError lets Sentry capture errors that bubble up from server
// components and route handlers without us having to wrap every export.

import * as Sentry from '@sentry/nextjs'

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('../sentry.server.config')
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('../sentry.edge.config')
    }
}

export const onRequestError = Sentry.captureRequestError

