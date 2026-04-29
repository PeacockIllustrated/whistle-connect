/**
 * Tiny env-var feature flags. Default ON — set the env var to literal
 * 'false' to disable. Used as kill switches for incident response — flip
 * a flag in Vercel without a redeploy to disable a flow in ~60 seconds.
 *
 * Read both server-side and client-side. Client-side reads need the var
 * to be NEXT_PUBLIC_ prefixed; we expose a parallel client-flag set via
 * NEXT_PUBLIC_* mirrors when a UI surface needs to disable a button.
 */

export const FEATURE_FLAGS = {
    WALLET_TOPUPS_ENABLED: 'WALLET_TOPUPS_ENABLED',
    WITHDRAWALS_ENABLED: 'WITHDRAWALS_ENABLED',
    WEB_PUSH_ENABLED: 'WEB_PUSH_ENABLED',
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

/**
 * Server-side flag check. Reads the matching env var, returns true unless
 * the value is the literal string 'false' (case-insensitive). Missing /
 * undefined / empty / any other value is treated as ON.
 */
export function isEnabled(flag: FeatureFlag): boolean {
    const value = process.env[flag]
    if (typeof value !== 'string') return true
    return value.trim().toLowerCase() !== 'false'
}

/**
 * Client-side mirror. Looks up NEXT_PUBLIC_<flag> first; falls back to
 * the bare name (rare — only relevant for non-Next environments). UI
 * surfaces use this to disable buttons when the corresponding server
 * flow is gated.
 */
export function isEnabledClient(flag: FeatureFlag): boolean {
    const publicValue = process.env[`NEXT_PUBLIC_${flag}`]
    if (typeof publicValue === 'string') {
        return publicValue.trim().toLowerCase() !== 'false'
    }
    return isEnabled(flag)
}

/** Standard "feature disabled" error shape returned by gated server actions. */
export const FEATURE_DISABLED_ERROR = (flag: FeatureFlag): { error: string; code: 'FEATURE_DISABLED' } => ({
    error: gatedMessage(flag),
    code: 'FEATURE_DISABLED',
})

function gatedMessage(flag: FeatureFlag): string {
    switch (flag) {
        case 'WALLET_TOPUPS_ENABLED':
            return 'Wallet top-ups are temporarily disabled. Please try again later.'
        case 'WITHDRAWALS_ENABLED':
            return 'Withdrawals are temporarily disabled. Please try again later.'
        case 'WEB_PUSH_ENABLED':
            return 'Web push is temporarily disabled.'
    }
}
