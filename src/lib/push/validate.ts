/**
 * VAPID key validation. Runs once on first send. Detects:
 *   - missing keys (returns clear error vs silent skip)
 *   - malformed base64url public key
 *   - public key wrong length (must be 65 bytes uncompressed P-256)
 *   - private/public key mismatch (someone pasted the wrong half into Vercel)
 *
 * Without this, a typo in either env var means push silently never delivers
 * — the app keeps running, in-app rows write fine, no errors, no alerts.
 *
 * Module-level cache means we only validate once per server instance. If
 * keys are rotated, the next deploy bumps process — no manual reset needed.
 */

import crypto from 'node:crypto'

type ValidationResult =
    | { ok: true }
    | { ok: false; reason: string; code: 'MISSING' | 'MALFORMED' | 'MISMATCH' }

let cached: ValidationResult | null = null

/** Strip URL-safe base64 chars to standard base64 and decode. */
function decodeBase64Url(str: string): Buffer {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/')
    const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    return Buffer.from(padded + padding, 'base64')
}

export function validateVapidKeys(): ValidationResult {
    if (cached) return cached

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    if (!publicKey || !privateKey) {
        cached = {
            ok: false,
            reason: `VAPID keys missing — NEXT_PUBLIC_VAPID_PUBLIC_KEY ${publicKey ? 'set' : 'MISSING'}, VAPID_PRIVATE_KEY ${privateKey ? 'set' : 'MISSING'}. Web push will not deliver.`,
            code: 'MISSING',
        }
        return cached
    }

    let publicBytes: Buffer
    let privateBytes: Buffer
    try {
        publicBytes = decodeBase64Url(publicKey)
        privateBytes = decodeBase64Url(privateKey)
    } catch (err) {
        cached = {
            ok: false,
            reason: `VAPID keys could not be base64url-decoded: ${(err as Error).message}`,
            code: 'MALFORMED',
        }
        return cached
    }

    // Public must be 65 bytes uncompressed P-256 (leading 0x04 byte + 64 bytes XY)
    if (publicBytes.length !== 65 || publicBytes[0] !== 0x04) {
        cached = {
            ok: false,
            reason: `VAPID public key has wrong shape — expected 65 bytes starting with 0x04, got ${publicBytes.length} bytes starting with 0x${publicBytes[0]?.toString(16) ?? '??'}.`,
            code: 'MALFORMED',
        }
        return cached
    }

    // Private must be 32 bytes
    if (privateBytes.length !== 32) {
        cached = {
            ok: false,
            reason: `VAPID private key has wrong length — expected 32 bytes, got ${privateBytes.length}.`,
            code: 'MALFORMED',
        }
        return cached
    }

    // Derive the public key from the private alone via ECDH on P-256, then
    // compare against the supplied public key. Constructing a JWK with both
    // d/x/y trusts the supplied x/y verbatim (no derivation happens), so
    // ECDH is the correct primitive here. Mismatched keys → derived bytes
    // won't equal supplied bytes → MISMATCH.
    try {
        const ecdh = crypto.createECDH('prime256v1')
        ecdh.setPrivateKey(privateBytes)
        const derivedPublic = ecdh.getPublicKey()  // 65-byte uncompressed point

        if (!derivedPublic.equals(publicBytes)) {
            cached = {
                ok: false,
                reason: 'VAPID public key does not match private key — they were not generated as a pair. One of the two env vars is wrong.',
                code: 'MISMATCH',
            }
            return cached
        }
    } catch (err) {
        cached = {
            ok: false,
            reason: `VAPID key derivation failed: ${(err as Error).message}`,
            code: 'MALFORMED',
        }
        return cached
    }

    cached = { ok: true }
    return cached
}

/**
 * Test-only — clears the module-level cache so the next call re-validates.
 * Not exported to runtime callers; safe to invoke from Vitest.
 */
export function _resetVapidValidationCacheForTests(): void {
    cached = null
}
