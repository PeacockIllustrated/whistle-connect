/**
 * In-memory sliding-window rate limiter for server actions.
 *
 * Each key (typically `userId:actionName`) stores an array of timestamps.
 * On each check the window is pruned, then the count is compared to the max.
 *
 * NOTE: This is per-instance — in a multi-instance deployment each server
 * node tracks its own counts. For a single Vercel deployment this is fine
 * because server actions run in the same serverless function pool.
 *
 * For abuse vectors where per-instance windows are NOT sufficient — notably
 * outbound transactional email, where an attacker rotating the target address
 * could mail-bomb arbitrary addresses past any per-lambda counter — use
 * `checkSharedEmailRateLimit` below, which is backed by a Postgres counter
 * (migration 0172) shared across every serverless instance.
 */

import { createAdminClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'

interface RateLimitConfig {
    /** Time window in milliseconds */
    windowMs: number
    /** Maximum requests allowed within the window */
    maxRequests: number
}

const store = new Map<string, number[]>()

// Periodic cleanup to prevent memory leaks from stale keys
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
let lastCleanup = Date.now()

function cleanupStaleKeys(now: number) {
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
    lastCleanup = now

    for (const [key, timestamps] of store.entries()) {
        // Remove keys whose newest timestamp is older than 1 hour
        if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > 60 * 60 * 1000) {
            store.delete(key)
        }
    }
}

/**
 * Check (and consume) a rate limit slot.
 *
 * @returns `null` if allowed, or an error string if rate-limited.
 */
export function checkRateLimit(
    key: string,
    config: RateLimitConfig
): string | null {
    const now = Date.now()
    cleanupStaleKeys(now)

    const windowStart = now - config.windowMs
    const timestamps = store.get(key) || []

    // Prune timestamps outside the current window
    const recent = timestamps.filter(t => t > windowStart)

    if (recent.length >= config.maxRequests) {
        store.set(key, recent)
        return 'Too many requests. Please try again shortly.'
    }

    recent.push(now)
    store.set(key, recent)
    return null
}

// ── Pre-configured limiters for common operations ────────────────────

/** Auth actions: 10 requests per 15 minutes */
export function checkAuthRateLimit(identifier: string): string | null {
    return checkRateLimit(`auth:${identifier}`, {
        windowMs: 15 * 60 * 1000,
        maxRequests: 10,
    })
}

/** Booking creation: 20 requests per hour */
export function checkBookingRateLimit(userId: string): string | null {
    return checkRateLimit(`createBooking:${userId}`, {
        windowMs: 60 * 60 * 1000,
        maxRequests: 20,
    })
}

/** Search: 10 requests per minute */
export function checkSearchRateLimit(userId: string): string | null {
    return checkRateLimit(`search:${userId}`, {
        windowMs: 60 * 1000,
        maxRequests: 10,
    })
}

/** Confirm price: 5 requests per minute */
export function checkConfirmRateLimit(userId: string): string | null {
    return checkRateLimit(`confirm:${userId}`, {
        windowMs: 60 * 1000,
        maxRequests: 5,
    })
}

/** Send booking request (offer): 10 requests per minute */
export function checkOfferRateLimit(userId: string): string | null {
    return checkRateLimit(`offer:${userId}`, {
        windowMs: 60 * 1000,
        maxRequests: 10,
    })
}

/** Wallet top-up: 5 requests per minute */
export function checkTopUpRateLimit(userId: string): string | null {
    return checkRateLimit(`topup:${userId}`, {
        windowMs: 60 * 1000,
        maxRequests: 5,
    })
}

/** Wallet withdrawal: 3 requests per minute */
export function checkWithdrawRateLimit(userId: string): string | null {
    return checkRateLimit(`withdraw:${userId}`, {
        windowMs: 60 * 1000,
        maxRequests: 3,
    })
}

// ── Shared-store backstop for outbound email (cross-instance) ─────────────

/** Outbound transactional email: max 5 sends per recipient per hour. */
const SHARED_EMAIL_WINDOW_SECONDS = 60 * 60
const SHARED_EMAIL_MAX = 5

/**
 * Cross-instance rate-limit check backed by the `rate_limit_hit` RPC
 * (migration 0172). Unlike the in-memory limiter above, this is shared across
 * every Vercel lambda, so it bounds the ABSOLUTE rate of outbound email even
 * when an attacker rotates the target address to dodge per-instance windows.
 *
 * Returns `{ ok: false }` when the recipient is over the limit (caller should
 * NOT send). FAILS OPEN: if the service-role client is unavailable (e.g. local
 * dev without SUPABASE_SERVICE_ROLE_KEY) or the RPC errors, it returns
 * `{ ok: true }` and Sentry-warns — we don't want to block legitimate email on
 * an infra hiccup. The in-memory limiter remains as defence in depth.
 *
 * @param identifierKey A stable key for the recipient, e.g. the email address.
 */
export async function checkSharedEmailRateLimit(
    identifierKey: string
): Promise<{ ok: boolean }> {
    const admin = createAdminClient()
    if (!admin) {
        // Fail open in local dev / missing key — but make it visible.
        Sentry.captureMessage('checkSharedEmailRateLimit: admin client unavailable — failing open', {
            level: 'warning',
            tags: { 'rate-limit.shared': 'admin-client-missing' },
        })
        return { ok: true }
    }

    const { data, error } = await admin.rpc('rate_limit_hit', {
        p_key: `email:${identifierKey.toLowerCase()}`,
        p_window_seconds: SHARED_EMAIL_WINDOW_SECONDS,
        p_max: SHARED_EMAIL_MAX,
    })

    if (error) {
        // Fail open on RPC error so a DB hiccup can't block all email.
        Sentry.captureMessage(`checkSharedEmailRateLimit: rate_limit_hit RPC failed — failing open: ${error.message}`, {
            level: 'warning',
            tags: { 'rate-limit.shared': 'rpc-error' },
        })
        return { ok: true }
    }

    // RPC returns TRUE when the caller is OVER the limit (should be blocked).
    return { ok: data !== true }
}
