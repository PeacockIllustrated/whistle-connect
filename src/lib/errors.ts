/**
 * Sanitise Supabase / PostgREST / Postgres error objects into user-friendly
 * messages so raw database text (including "row-level security policy"
 * violations) never reaches a toast or alert in the UI.
 *
 * Server actions that currently return `{ error: error.message }` should
 * instead return `{ error: friendlyError(error) }`.
 */

export type SupabaseLikeError = {
    message?: string
    code?: string
    details?: string | null
    hint?: string | null
} | null | undefined

/** Map a Supabase/Postgres error to a short, user-facing string. */
export function friendlyError(err: SupabaseLikeError, fallback = 'Something went wrong. Please try again.'): string {
    if (!err) return fallback
    const message = (err.message || '').toLowerCase()
    const code = err.code || ''

    // RLS / permission failures — the one the user actually sees as a scary popup
    if (
        message.includes('row-level security') ||
        message.includes('row level security') ||
        message.includes('permission denied') ||
        message.includes('new row violates') ||
        code === '42501' // insufficient_privilege
    ) {
        return "You don't have permission to do that."
    }

    // Unique constraint — already exists
    if (code === '23505' || message.includes('duplicate key')) {
        return 'That record already exists.'
    }

    // Foreign key violation — referenced thing is missing
    if (code === '23503' || message.includes('foreign key')) {
        return "That action references something that doesn't exist anymore."
    }

    // Not null constraint — field missing
    if (code === '23502' || message.includes('not-null constraint') || message.includes('null value in column')) {
        return 'A required field is missing.'
    }

    // Check constraint — invalid value
    if (code === '23514' || message.includes('check constraint')) {
        return 'That value is not allowed here.'
    }

    // Network / fetch failures
    if (message.includes('failed to fetch') || message.includes('network')) {
        return 'Network issue. Check your connection and try again.'
    }

    // JWT / auth expired
    if (message.includes('jwt') || message.includes('token')) {
        return 'Your session expired. Please sign in again.'
    }

    // If the message looks short and user-friendly already, keep it
    const raw = (err.message || '').trim()
    if (raw && raw.length < 120 && !/[()"'`]|supabase|postgres|rpc|rls|policy/i.test(raw)) {
        return raw
    }

    return fallback
}
