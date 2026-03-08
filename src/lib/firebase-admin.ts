/**
 * Lightweight Firebase Cloud Messaging sender using the FCM HTTP v1 API.
 *
 * Zero external dependencies — uses Node's built-in crypto module for JWT signing
 * and the global fetch API for HTTP requests.
 *
 * Requires the FIREBASE_SERVICE_ACCOUNT env var to contain the full JSON
 * of a Google Cloud service account key (project_id, client_email, private_key).
 */

import { createSign } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServiceAccount {
    project_id: string
    client_email: string
    private_key: string
}

interface FCMNotification {
    title: string
    body: string
}

interface FCMAndroidConfig {
    priority?: 'high' | 'normal'
    notification?: {
        channelId?: string
        priority?: 'max' | 'high' | 'default' | 'low' | 'min'
        defaultVibrateTimings?: boolean
        vibrateTimingsMillis?: string[]
    }
}

interface FCMApnsConfig {
    headers?: Record<string, string>
    payload?: {
        aps?: {
            alert?: { title: string; body: string }
            sound?: string
            'interruption-level'?: 'passive' | 'active' | 'time-sensitive' | 'critical'
        }
    }
}

export interface FCMMessage {
    token: string
    notification: FCMNotification
    data?: Record<string, string>
    android?: FCMAndroidConfig
    apns?: FCMApnsConfig
}

// ---------------------------------------------------------------------------
// Service account & token cache
// ---------------------------------------------------------------------------

let cachedServiceAccount: ServiceAccount | null = null
let cachedAccessToken: string | null = null
let tokenExpiresAt = 0

function getServiceAccount(): ServiceAccount | null {
    if (cachedServiceAccount) return cachedServiceAccount

    const json = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!json) return null

    try {
        const sa = JSON.parse(json) as ServiceAccount
        if (!sa.project_id || !sa.client_email || !sa.private_key) {
            console.error('[FCM] Service account JSON missing required fields')
            return null
        }
        cachedServiceAccount = sa
        return sa
    } catch {
        console.error('[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT')
        return null
    }
}

// ---------------------------------------------------------------------------
// JWT → OAuth2 access token
// ---------------------------------------------------------------------------

function base64url(input: string | Buffer): string {
    const buf = typeof input === 'string' ? Buffer.from(input) : input
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Creates a signed JWT and exchanges it for a Google OAuth2 access token.
 * Tokens are cached until 5 minutes before expiry.
 */
async function getAccessToken(): Promise<string | null> {
    // Return cached token if still valid
    if (cachedAccessToken && Date.now() < tokenExpiresAt) {
        return cachedAccessToken
    }

    const sa = getServiceAccount()
    if (!sa) return null

    const now = Math.floor(Date.now() / 1000)
    const exp = now + 3600 // 1 hour

    // Build JWT
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const payload = base64url(JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp,
    }))

    const signInput = `${header}.${payload}`
    const signer = createSign('RSA-SHA256')
    signer.update(signInput)
    const signature = base64url(signer.sign(sa.private_key))

    const jwt = `${signInput}.${signature}`

    // Exchange JWT for access token
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
        })

        if (!response.ok) {
            console.error('[FCM] Token exchange failed:', response.status, await response.text())
            return null
        }

        const data = await response.json() as { access_token: string; expires_in: number }
        cachedAccessToken = data.access_token
        // Cache until 5 minutes before expiry
        tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000
        return cachedAccessToken
    } catch (error) {
        console.error('[FCM] Token exchange error:', error)
        return null
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if Firebase is configured (service account env var is set).
 */
export function isFirebaseConfigured(): boolean {
    return getServiceAccount() !== null
}

/**
 * Sends a push notification via the FCM HTTP v1 API.
 *
 * Returns the FCM message name on success, or throws on failure.
 * Specific error codes (e.g. UNREGISTERED) are preserved for token cleanup.
 */
export async function sendFCMMessage(message: FCMMessage): Promise<string> {
    const sa = getServiceAccount()
    if (!sa) throw new Error('Firebase not configured')

    const accessToken = await getAccessToken()
    if (!accessToken) throw new Error('Failed to get FCM access token')

    const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
    })

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { status: 'UNKNOWN' } })) as {
            error?: { status?: string; message?: string }
        }
        const errorCode = errorBody?.error?.status || 'UNKNOWN'
        const error = new Error(`FCM send failed: ${errorCode}`) as Error & { code: string }
        error.code = errorCode
        throw error
    }

    const result = await response.json() as { name: string }
    return result.name
}
