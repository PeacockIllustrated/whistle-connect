/**
 * Validated Supabase environment variables.
 *
 * IMPORTANT: Next.js only inlines NEXT_PUBLIC_* env vars when accessed
 * via the literal expression (e.g. process.env.NEXT_PUBLIC_SUPABASE_URL).
 * Dynamic access like process.env[name] will be undefined on the client.
 * That's why we use the literal strings here, not a generic helper.
 */

/** Supabase project URL — validated on first access */
export function getSupabaseUrl(): string {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!value) {
        throw new Error(
            'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL. ' +
            'Add it to your .env.local file or Vercel environment settings.'
        )
    }
    return value
}

/** Supabase anon key — validated on first access */
export function getSupabaseAnonKey(): string {
    const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!value) {
        throw new Error(
            'Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
            'Add it to your .env.local file or Vercel environment settings.'
        )
    }
    return value
}
