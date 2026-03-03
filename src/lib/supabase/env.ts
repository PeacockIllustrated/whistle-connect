/**
 * Validated Supabase environment variables.
 * Uses lazy getters so validation happens on first use (at runtime),
 * not at module import time (which would break the build without env vars).
 */

function requireEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(
            `Missing required environment variable: ${name}. ` +
            `Add it to your .env.local file or Vercel environment settings.`
        )
    }
    return value
}

let _supabaseUrl: string | undefined
let _supabaseAnonKey: string | undefined

/** Supabase project URL — validated on first access */
export function getSupabaseUrl(): string {
    if (!_supabaseUrl) {
        _supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
    }
    return _supabaseUrl
}

/** Supabase anon key — validated on first access */
export function getSupabaseAnonKey(): string {
    if (!_supabaseAnonKey) {
        _supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    return _supabaseAnonKey
}
