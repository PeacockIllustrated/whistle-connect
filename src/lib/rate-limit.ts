/**
 * In-memory sliding-window rate limiter for server actions.
 *
 * Each key (typically `userId:actionName`) stores an array of timestamps.
 * On each check the window is pruned, then the count is compared to the max.
 *
 * NOTE: This is per-instance — in a multi-instance deployment each server
 * node tracks its own counts. For a single Vercel deployment this is fine
 * because server actions run in the same serverless function pool.
 */

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
