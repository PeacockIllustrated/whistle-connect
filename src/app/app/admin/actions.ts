'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FAVerificationStatus } from '@/lib/types'
import { createNotification } from '@/lib/notifications'
import { geocodePostcode } from '@/lib/mapbox/geocode'
import { sendFAVerificationEmail } from '@/lib/email/fa-verification'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') return null
    return user
}

export async function verifyReferee(refereeId: string, verified: boolean) {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return { error: 'Admin access required' }

    const { error } = await supabase
        .from('referee_profiles')
        .update({ verified })
        .eq('profile_id', refereeId)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/app/admin/referees')
    revalidatePath(`/app/admin/referees/${refereeId}`)
    return { success: true }
}

export async function updateFAVerificationStatus(
    refereeId: string,
    status: FAVerificationStatus
) {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return { error: 'Admin access required' }

    const { error } = await supabase
        .from('referee_profiles')
        .update({ fa_verification_status: status })
        .eq('profile_id', refereeId)

    if (error) {
        return { error: error.message }
    }

    // If verifying or rejecting, also resolve any open verification requests
    if (status === 'verified' || status === 'rejected') {
        const resolution = status === 'verified' ? 'confirmed' : 'rejected'
        await supabase
            .from('fa_verification_requests')
            .update({
                status: resolution,
                resolved_at: new Date().toISOString(),
                resolved_by: user.id,
            })
            .eq('referee_id', refereeId)
            .eq('status', 'awaiting_fa_response')

        // Notify the referee
        await createNotification({
            userId: refereeId,
            title: status === 'verified' ? 'FA Number Verified' : 'FA Number Rejected',
            message: status === 'verified'
                ? 'Your FA number has been verified by an administrator.'
                : 'Your FA number verification was not successful. Please check your FA number and try again.',
            type: status === 'verified' ? 'success' : 'warning',
            link: '/app/profile',
        })
    }

    revalidatePath('/app/admin/referees')
    revalidatePath(`/app/admin/referees/${refereeId}`)
    revalidatePath('/app/admin/verification')
    return { success: true }
}

export async function createFAVerificationRequest(refereeId: string) {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return { error: 'Admin access required' }

    // Get referee's FA details
    const { data: referee } = await supabase
        .from('referee_profiles')
        .select('fa_id, county, profile:profiles!inner(full_name)')
        .eq('profile_id', refereeId)
        .single()

    if (!referee) return { error: 'Referee not found' }
    if (!referee.fa_id) return { error: 'Referee has no FA number to verify' }
    if (!referee.county) return { error: 'Referee has no county set — needed to contact the County FA' }

    // Get county FA email
    const { data: contact } = await supabase
        .from('county_fa_contacts')
        .select('email')
        .eq('county_name', referee.county)
        .maybeSingle()

    if (!contact) return { error: `No FA contact email found for county "${referee.county}"` }

    // Create the verification request
    const { data: request, error } = await supabase
        .from('fa_verification_requests')
        .insert({
            referee_id: refereeId,
            fa_id: referee.fa_id,
            county: referee.county,
            requested_by: user.id,
        })
        .select()
        .single()

    if (error) return { error: error.message }

    // Update status to pending if not already
    await supabase
        .from('referee_profiles')
        .update({ fa_verification_status: 'pending' })
        .eq('profile_id', refereeId)

    // Extract referee name from the join result
    const profile = Array.isArray(referee.profile) ? referee.profile[0] : referee.profile
    const refereeName = (profile as { full_name: string })?.full_name || 'Unknown'

    // Send automated verification email
    let emailSent = false
    try {
        const emailResult = await sendFAVerificationEmail({
            refereeName,
            faId: referee.fa_id,
            county: referee.county,
        })
        emailSent = emailResult.success
        if (!emailResult.success) {
            console.error('FA verification email failed:', emailResult.error)
        }
    } catch (emailErr) {
        console.error('Failed to send FA verification email:', emailErr)
    }

    revalidatePath('/app/admin/referees')
    revalidatePath(`/app/admin/referees/${refereeId}`)
    revalidatePath('/app/admin/verification')

    return {
        success: true,
        request,
        emailSent,
    }
}

export async function resolveVerificationRequest(
    requestId: string,
    resolution: 'confirmed' | 'rejected',
    notes?: string
) {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return { error: 'Admin access required' }

    // Get the request to find the referee
    const { data: request } = await supabase
        .from('fa_verification_requests')
        .select('referee_id')
        .eq('id', requestId)
        .single()

    if (!request) return { error: 'Verification request not found' }

    // Update the request
    const { error } = await supabase
        .from('fa_verification_requests')
        .update({
            status: resolution,
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
            notes: notes || null,
        })
        .eq('id', requestId)

    if (error) return { error: error.message }

    // Update referee's FA verification status
    const faStatus: FAVerificationStatus = resolution === 'confirmed' ? 'verified' : 'rejected'
    await supabase
        .from('referee_profiles')
        .update({ fa_verification_status: faStatus })
        .eq('profile_id', request.referee_id)

    // Notify the referee
    await createNotification({
        userId: request.referee_id,
        title: resolution === 'confirmed' ? 'FA Number Verified' : 'FA Number Rejected',
        message: resolution === 'confirmed'
            ? 'Your FA number has been confirmed by your County FA.'
            : 'Your FA number could not be verified by your County FA. Please check it is correct.',
        type: resolution === 'confirmed' ? 'success' : 'warning',
        link: '/app/profile',
    })

    revalidatePath('/app/admin/referees')
    revalidatePath(`/app/admin/referees/${request.referee_id}`)
    revalidatePath('/app/admin/verification')
    return { success: true }
}

export async function getVerificationRequests() {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return { error: 'Admin access required' }

    const { data, error } = await supabase
        .from('fa_verification_requests')
        .select(`
            *,
            referee:profiles!fa_verification_requests_referee_id_fkey(id, full_name, avatar_url),
            requester:profiles!fa_verification_requests_requested_by_fkey(full_name)
        `)
        .order('requested_at', { ascending: false })

    if (error) return { error: error.message }
    return { data }
}

// ── Geolocation Backfill ────────────────────────────────────────────────

export async function backfillGeolocations() {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return { error: 'Admin access required' }

    let profilesUpdated = 0
    let bookingsUpdated = 0

    // Backfill profiles with postcodes but no coordinates
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, postcode')
        .not('postcode', 'is', null)
        .is('latitude', null)
        .limit(100)

    if (profiles) {
        for (const profile of profiles) {
            if (!profile.postcode) continue
            const geo = await geocodePostcode(profile.postcode)
            if (geo) {
                await supabase
                    .from('profiles')
                    .update({ latitude: geo.lat, longitude: geo.lng })
                    .eq('id', profile.id)
                profilesUpdated++
            }
        }
    }

    // Backfill bookings with postcodes but no coordinates
    const { data: bookings } = await supabase
        .from('bookings')
        .select('id, location_postcode')
        .not('location_postcode', 'is', null)
        .is('latitude', null)
        .limit(100)

    if (bookings) {
        for (const booking of bookings) {
            if (!booking.location_postcode) continue
            const geo = await geocodePostcode(booking.location_postcode)
            if (geo) {
                await supabase
                    .from('bookings')
                    .update({ latitude: geo.lat, longitude: geo.lng })
                    .eq('id', booking.id)
                bookingsUpdated++
            }
        }
    }

    return { success: true, profilesUpdated, bookingsUpdated }
}
