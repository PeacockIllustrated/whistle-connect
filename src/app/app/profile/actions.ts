'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isValidFANumber } from '@/lib/utils'
import { geocodePostcode } from '@/lib/mapbox/geocode'

export async function updateProfile(formData: {
    full_name: string
    postcode: string
    phone: string
    club_name?: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // Geocode postcode to lat/lon for distance-based features
    // Geocode may fail server-side (e.g. token URL restrictions), so only update coords if successful
    const updateData: Record<string, unknown> = {
        full_name: formData.full_name,
        postcode: formData.postcode,
        phone: formData.phone,
        updated_at: new Date().toISOString()
    }

    if (formData.club_name !== undefined) {
        updateData.club_name = formData.club_name || null
    }

    if (formData.postcode) {
        const geo = await geocodePostcode(formData.postcode)
        if (geo) {
            updateData.latitude = geo.lat
            updateData.longitude = geo.lng
        }
    } else {
        // Postcode cleared — clear coords too
        updateData.latitude = null
        updateData.longitude = null
    }

    const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

    if (error) {
        console.error('Error updating profile:', error)
        return { error: error.message }
    }

    revalidatePath('/app/profile')
    return { success: true }
}

export async function updateAvatarUrl(url: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const { error } = await supabase
        .from('profiles')
        .update({
            avatar_url: url,
            updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

    if (error) {
        console.error('Error updating avatar URL:', error)
        return { error: error.message }
    }

    revalidatePath('/app/profile')
    return { success: true }
}

/**
 * Get the current user's postcode (for client-side geocoding).
 */
export async function getMyPostcode(): Promise<{ postcode?: string; hasCoords?: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('postcode, latitude, longitude')
        .eq('id', user.id)
        .single()

    if (!profile) return { error: 'Profile not found' }
    if (profile.latitude && profile.longitude) return { hasCoords: true }
    if (!profile.postcode) return { error: 'No postcode set' }

    return { postcode: profile.postcode }
}

/**
 * Save lat/lon to the current user's profile (called after client-side geocoding).
 */
export async function saveMyGeolocation(lat: number, lng: number): Promise<{ success?: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('profiles')
        .update({ latitude: lat, longitude: lng })
        .eq('id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/app/profile')
    return { success: true }
}

export async function updateFANumber(faNumber: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // Validate format if setting a number
    if (faNumber && !isValidFANumber(faNumber)) {
        return { error: 'FA number must be 8-10 digits' }
    }

    // Check for duplicates
    if (faNumber) {
        const { data: existing } = await supabase
            .from('referee_profiles')
            .select('profile_id')
            .eq('fa_id', faNumber)
            .neq('profile_id', user.id)
            .maybeSingle()
        if (existing) {
            return { error: 'This FA number is already registered to another referee' }
        }
    }

    // Update FA number and reset verification status
    const { error } = await supabase
        .from('referee_profiles')
        .update({
            fa_id: faNumber || null,
            fa_verification_status: faNumber ? 'pending' : 'not_provided',
        })
        .eq('profile_id', user.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/app/profile')
    return { success: true }
}

/**
 * Delete the current user's account (App Store 5.1.1(v) / Play Store requirement).
 *
 * The heavy lifting is in the `request_account_deletion` RPC (migration 0158):
 * it self-checks auth.uid(), BLOCKS deletion if the user still has a wallet
 * balance / pending withdrawal / held escrow / active bookings (raising a
 * user-facing message), and otherwise ANONYMIZES the profile rather than
 * hard-deleting (financial/audit rows must be retained). After the RPC
 * succeeds we disable login at the auth layer: ban the user (so the session is
 * dead and re-login is refused) AND release their email (so they could sign up
 * fresh later). Both go in a single admin update. Finally sign the cookie
 * session out so the client lands logged-out.
 */
export async function deleteMyAccount(): Promise<{ success?: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // Acquire the admin client BEFORE the anonymising RPC. Deletion must also
    // disable login via an admin auth update; if the service-role key is
    // missing we fail HERE, before any data is touched, rather than anonymising
    // the profile and then being unable to disable login (which would leave an
    // anonymised-but-still-loggable account).
    const admin = createAdminClient()
    if (!admin) {
        return { error: 'Account deletion is temporarily unavailable. Please try again later or contact support.' }
    }

    // RPC enforces the money-safe blocking conditions + anonymizes the data.
    const { error: rpcError } = await supabase.rpc('request_account_deletion')
    if (rpcError) {
        // The RPC RAISEs a clean, user-facing message for blocking conditions.
        return { error: rpcError.message }
    }

    // Disable login: a ban kills the session and refuses re-login; freeing the
    // email lets them register again in future. Combined into one update call.
    const { error: banError } = await admin.auth.admin.updateUserById(user.id, {
        ban_duration: '876000h', // ~100 years — effectively permanent
        email: `deleted+${user.id}@whistleconnect.co.uk`,
    })
    if (banError) {
        return { error: 'Account data removed, but login could not be disabled. Please contact support.' }
    }

    // Clear the cookie session so the user is logged out client-side.
    await supabase.auth.signOut()

    return { success: true }
}

/**
 * GDPR data export (right to data portability). Returns a structured JSON
 * snapshot of the signed-in user's own data — own-data reads only, scoped by
 * the cookie client + RLS. The client turns this payload into a file download.
 */
export async function exportMyData(): Promise<{ success?: boolean; data?: Record<string, unknown>; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const [profileRes, refRes, bookingsRes, offersRes, assignmentsRes, messagesRes, walletRes, notificationsRes] =
        await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
            supabase.from('referee_profiles').select('*').eq('profile_id', user.id).maybeSingle(),
            supabase.from('bookings').select('*').eq('coach_id', user.id),
            supabase.from('booking_offers').select('*').eq('referee_id', user.id),
            supabase.from('booking_assignments').select('*').eq('referee_id', user.id),
            supabase.from('messages').select('*').eq('sender_id', user.id),
            supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
            supabase.from('notifications').select('*').eq('user_id', user.id),
        ])

    // wallet_transactions are keyed by wallet_id, so resolve the wallet first.
    let walletTransactions: unknown[] = []
    if (walletRes.data?.id) {
        const { data: tx } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('wallet_id', walletRes.data.id)
        walletTransactions = tx ?? []
    }

    return {
        success: true,
        data: {
            exported_at: new Date().toISOString(),
            account: { id: user.id, email: user.email },
            profile: profileRes.data,
            referee_profile: refRes.data,
            bookings: bookingsRes.data ?? [],
            offers_received: offersRes.data ?? [],
            assignments: assignmentsRes.data ?? [],
            messages_sent: messagesRes.data ?? [],
            wallet: walletRes.data,
            wallet_transactions: walletTransactions,
            notifications: notificationsRes.data ?? [],
        },
    }
}

// ── Notification Test Simulator ────────────────────────────────────────────

const TEST_SCENARIOS = [
    {
        title: 'SOS — Referee Needed!',
        message: 'Urgent: A match at Hackney Marshes needs a referee today at 14:00! 3 km from you.',
        type: 'warning' as const,
        urgency: 'sos' as const,
        link: '/app/bookings',
    },
    {
        title: 'New Booking Request',
        message: 'Coach Mike has sent you a booking request for Saturday at Victoria Park.',
        type: 'info' as const,
        link: '/app/offers',
    },
    {
        title: 'Offer Priced!',
        message: 'A referee has accepted your booking request and sent a price of £35 for Hackney Downs.',
        type: 'info' as const,
        link: '/app/bookings',
    },
    {
        title: 'Booking Confirmed!',
        message: 'The coach has accepted your price. The booking for Springfield Park is now confirmed.',
        type: 'success' as const,
        link: '/app/bookings',
    },
    {
        title: 'Referee Pulled Out',
        message: 'The assigned referee has cancelled the booking for London Fields. You can search for a new referee.',
        type: 'warning' as const,
        link: '/app/bookings',
    },
    {
        title: 'Match Completed',
        message: 'The coach has marked the booking for Mabley Green as completed. Well done!',
        type: 'success' as const,
        link: '/app/bookings',
    },
    {
        title: 'Offer Declined',
        message: 'A referee declined your booking request for Weavers Fields.',
        type: 'info' as const,
        link: '/app/bookings',
    },
]

export async function fireTestNotification(scenarioIndex: number) {
    const { createNotification } = await import('@/lib/notifications')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const scenario = TEST_SCENARIOS[scenarioIndex % TEST_SCENARIOS.length]

    const result = await createNotification({
        userId: user.id,
        title: scenario.title,
        message: scenario.message,
        type: scenario.type,
        link: scenario.link,
        urgency: scenario.urgency || 'normal',
    })

    if (!result.success) return { error: result.error || 'Failed to send' }

    return { success: true, scenario: scenario.title }
}

export async function getTestScenarios() {
    return TEST_SCENARIOS.map(s => ({ title: s.title, type: s.type }))
}
