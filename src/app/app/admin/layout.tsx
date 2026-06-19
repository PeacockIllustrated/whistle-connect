import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Single chokepoint for the admin area. Admin accounts can move escrow, suspend
 * users and override safeguarding, so this layer enforces two-factor (Cyber
 * Essentials: MFA on administrative access) on top of the role check.
 *
 * Individual admin pages keep their own role guard as defence-in-depth; this
 * layout is the authoritative gate and the only place the MFA step-up is
 * required.
 *
 *  - not signed in            → /auth/login
 *  - signed in, not admin     → /app
 *  - admin without aal2        → /app/security/two-factor (enrol or step up),
 *                                returning to the admin area once satisfied
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') redirect('/app')

    // currentLevel === 'aal2' means MFA has been satisfied for THIS session.
    // 'aal1' (with or without an enrolled factor) means we must send them to
    // enrol or to enter their current code before any admin page renders.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!aal || aal.currentLevel !== 'aal2') {
        redirect(`/app/security/two-factor?required=1&next=${encodeURIComponent('/app/admin/referees')}`)
    }

    return <>{children}</>
}
