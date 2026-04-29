'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Mount-time check: if a user is already signed in, replace the current
 * route with `redirectTo`. Returns `checked` so the caller can avoid
 * flashing the auth form to a user who is about to be bounced.
 *
 * Use on `/auth/login`, `/auth/register`, `/auth/forgot-password`.
 * Do NOT use on `/auth/reset-password` — the recovery session is what
 * makes the password update work.
 */
export function useRedirectIfAuthed(redirectTo: string = '/app'): { checked: boolean } {
    const router = useRouter()
    const [checked, setChecked] = useState(false)

    useEffect(() => {
        let cancelled = false
        const supabase = createClient()
        supabase.auth.getUser().then(({ data }) => {
            if (cancelled) return
            if (data.user) {
                router.replace(redirectTo)
            } else {
                setChecked(true)
            }
        })
        return () => { cancelled = true }
    }, [router, redirectTo])

    return { checked }
}
