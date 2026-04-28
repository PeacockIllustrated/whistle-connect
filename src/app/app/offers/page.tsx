import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RoleAccessDenied } from '@/components/app/RoleAccessDenied'
import { UserRole } from '@/lib/types'
import { Inbox } from 'lucide-react'
import { RefereeOfferCard, type RefereeOfferCardData } from '@/components/app/RefereeOfferCard'

interface OfferWithBooking extends RefereeOfferCardData {
    booking: RefereeOfferCardData['booking'] & {
        deleted_at: string | null
        competition_type: string | null
        notes: string | null
    }
}

export default async function OffersPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'referee') {
        return (
            <RoleAccessDenied
                requiredRole="referee"
                currentRole={profile?.role as UserRole}
                featureName="Incoming Offers"
                description="This feature is for referees to view and respond to match requests. As a coach, you can send offers from the booking pages."
            />
        )
    }

    // Fetch active offers for this referee (sent + accepted_priced)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: rawOffers, error: _error } = await supabase
        .from('booking_offers')
        .select(`
            *,
            booking:bookings(
                id,
                match_date,
                kickoff_time,
                ground_name,
                location_postcode,
                age_group,
                format,
                competition_type,
                notes,
                home_team,
                away_team,
                deleted_at,
                coach:profiles(full_name)
            )
        `)
        .eq('referee_id', user.id)
        .in('status', ['sent'])
        .order('created_at', { ascending: false })

    // Filter out offers for soft-deleted bookings
    const offers = (rawOffers as OfferWithBooking[] | null)?.filter(
        o => o.booking && !o.booking.deleted_at
    ) ?? []

    return (
        <div className="px-4 py-6 max-w-[var(--content-max-width)] mx-auto">
            <header className="mb-8">
                <h1 className="text-2xl font-bold mb-1">Incoming Offers</h1>
                <p className="text-[var(--foreground-muted)]">
                    Review and respond to match requests from coaches.
                </p>
            </header>

            {offers && offers.length > 0 ? (
                <div className="space-y-4">
                    {offers.map((offer) => (
                        <RefereeOfferCard key={offer.id} offer={offer} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[var(--border-color)]">
                    <div className="w-16 h-16 bg-[var(--neutral-50)] rounded-full flex items-center justify-center mx-auto mb-4">
                        <Inbox className="w-8 h-8 text-[var(--neutral-400)]" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">All caught up!</h3>
                    <p className="text-[var(--foreground-muted)] text-sm">
                        You don&apos;t have any pending match offers at the moment.
                    </p>
                </div>
            )}
        </div>
    )
}
