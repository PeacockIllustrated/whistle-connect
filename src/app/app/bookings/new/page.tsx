import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RoleAccessDenied } from '@/components/app/RoleAccessDenied'
import { NewBookingForm } from './NewBookingForm'
import type { UserRole } from '@/lib/types'

// Server guard: bookings are coach-only. Enforced here (no flash / no client
// double-fetch) and again in the createBooking action (defence in depth). The
// /book interstitial routes here with ?type=individual|central|tournament.
export default async function NewBookingPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login?returnTo=/app/bookings/new')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'coach') {
        return (
            <div className="px-4 py-8">
                <RoleAccessDenied
                    requiredRole="coach"
                    currentRole={(profile?.role as UserRole | undefined) ?? undefined}
                    featureName="Book a Referee"
                    description="Booking referees is for coaches. As a referee, you'll receive booking offers from coaches in your feed."
                />
            </div>
        )
    }

    return <NewBookingForm />
}
