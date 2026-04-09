import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * OAuth / email-link callback handler.
 *
 * Supabase email flows (password recovery, email confirmation, magic link)
 * redirect here with a `code` query parameter. We exchange that code for a
 * session cookie so the user is authenticated when they land on `next`.
 *
 * For the forgot-password flow, `next` is `/auth/reset-password` where the
 * user sets a new password using the temporary session established here.
 */
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const rawNext = searchParams.get('next') ?? '/app'

    // Only allow relative redirects to prevent open-redirect attacks
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/app'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            return NextResponse.redirect(`${origin}${next}`)
        }

        console.error('exchangeCodeForSession error:', error.message)
    }

    // If the code is missing or the exchange failed, bounce back to login
    // with a friendly error message.
    return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent('Your reset link is invalid or has expired. Please request a new one.')}`
    )
}
