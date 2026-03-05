/**
 * Mapbox access token — validated on first access.
 *
 * IMPORTANT: Next.js only inlines NEXT_PUBLIC_* env vars when accessed
 * via the literal expression. That's why we use the literal string here.
 */
export function getMapboxAccessToken(): string {
    const value = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    if (!value) {
        throw new Error(
            'Missing required environment variable: NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN. ' +
            'Add it to your .env.local file or Vercel environment settings.'
        )
    }
    return value
}
