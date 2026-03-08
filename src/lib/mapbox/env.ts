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

const DEFAULT_LIGHT_STYLE = 'mapbox://styles/mapbox/light-v11'
const DEFAULT_DARK_STYLE = 'mapbox://styles/mapbox/dark-v11'

/**
 * Returns the Mapbox style URL for the given theme.
 * Uses custom branded styles if NEXT_PUBLIC_MAPBOX_STYLE_LIGHT / _DARK
 * are set, otherwise falls back to Mapbox defaults.
 */
export function getMapboxStyle(theme: 'light' | 'dark'): string {
    if (theme === 'dark') {
        return process.env.NEXT_PUBLIC_MAPBOX_STYLE_DARK || DEFAULT_DARK_STYLE
    }
    return process.env.NEXT_PUBLIC_MAPBOX_STYLE_LIGHT || DEFAULT_LIGHT_STYLE
}
