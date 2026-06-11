import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseUrl, getSupabaseAnonKey } from './env'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        getSupabaseUrl(),
        getSupabaseAnonKey(),
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Protected routes - require authentication
    if (
        !user &&
        request.nextUrl.pathname.startsWith('/app')
    ) {
        const url = request.nextUrl.clone()
        // Preserve the intended destination as returnTo parameter
        const returnTo = request.nextUrl.pathname + request.nextUrl.search
        url.pathname = '/auth/login'
        url.search = `?returnTo=${encodeURIComponent(returnTo)}`
        return NextResponse.redirect(url)
    }

    // Deferred-onboarding gate. A "generic" signup (e.g. via the World Cup
    // sweepstake) has profiles.setup_complete=false and a placeholder role.
    // Before such a user can reach any role-specific page under /app, send them
    // to /finish-setup to choose coach/referee and complete their account. The
    // gate runs ONLY for /app/* (the real app) — the public World Cup tool is
    // deliberately left frictionless.
    if (user && request.nextUrl.pathname.startsWith('/app')) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('setup_complete')
            .eq('id', user.id)
            .maybeSingle()

        if (profile && profile.setup_complete === false) {
            const url = request.nextUrl.clone()
            url.pathname = '/finish-setup'
            url.search = ''
            return NextResponse.redirect(url)
        }
    }

    return supabaseResponse
}
