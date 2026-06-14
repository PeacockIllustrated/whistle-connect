'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FAVerificationStatus } from '@/lib/types'
import { createNotification } from '@/lib/notifications'
import { geocodePostcode } from '@/lib/mapbox/geocode'
import { sendFAVerificationEmail } from '@/lib/email/fa-verification'
import { logAdminAction } from '@/lib/admin/audit'

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

/**
 * Broadcast an in-app + push notification to EVERY user. Admin-only via the
 * cookie session (mirrors POST /api/admin/broadcast-push but without exposing
 * CRON_SECRET to the browser). `dryRun` returns the recipient count without
 * sending anything. Recorded in admin_audit_log.
 *
 * Fan-out uses the service-role client (via createNotification) so it can write
 * to every recipient regardless of RLS. Promise.allSettled means one failed
 * recipient never tanks the whole broadcast.
 */
export async function broadcastNotification(input: {
    title: string
    message: string
    link?: string
    dryRun?: boolean
}): Promise<{ success?: boolean; recipients?: number; dispatched?: number; error?: string }> {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return { error: 'Admin access required' }

    const title = (input.title || '').trim()
    const message = (input.message || '').trim()
    if (!title || title.length > 60) return { error: 'Title is required (max 60 characters).' }
    if (!message || message.length > 300) return { error: 'Message is required (max 300 characters).' }
    const link = (input.link || '').trim() || '/app'

    const admin = createAdminClient()
    if (!admin) return { error: 'Notification service is unavailable.' }

    const { data: profiles, error } = await admin.from('profiles').select('id')
    if (error) return { error: error.message }
    const recipients = profiles?.length ?? 0

    // Dry run: just report how many people this would reach.
    if (input.dryRun) return { success: true, recipients }

    const results = await Promise.allSettled(
        (profiles || []).map(p =>
            createNotification({ userId: p.id, title, message, type: 'info', link })
        )
    )
    const dispatched = results.filter(
        r => r.status === 'fulfilled' && r.value.success !== false
    ).length

    await logAdminAction({
        actorId: user.id,
        action: 'notification.broadcast',
        summary: `Broadcast "${title}" to ${dispatched}/${recipients} user(s)`,
        detail: { title, message, link, recipients, dispatched },
    })

    return { success: true, recipients, dispatched }
}

export async function verifyReferee(refereeId: string, verified: boolean) {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return { error: 'Admin access required' }

    // When verifying, promote FA, DBS and safeguarding together. Per the admin
    // process a referee can't hold an FA number without DBS and safeguarding
    // clearance, so confirming the FA number confirms all three — and the
    // referee's own profile plus the referee cards coaches see read these
    // statuses. When un-verifying we roll the same three back so we never show
    // verified credentials for a referee who is no longer verified.
    const updateData: Record<string, unknown> = { verified }
    if (verified) {
        updateData.fa_verification_status = 'verified'
        updateData.dbs_status = 'verified'
        updateData.safeguarding_status = 'verified'
    }

    const { error } = await supabase
        .from('referee_profiles')
        .update(updateData)
        .eq('profile_id', refereeId)

    // If un-verifying, roll back only the statuses we'd have promoted, and only
    // where they're currently 'verified' (don't clobber 'pending'/'rejected'/
    // 'expired'/'provided' set through other flows).
    if (!verified) {
        const rollbacks: Array<[string, string]> = [
            ['fa_verification_status', 'pending'],
            ['dbs_status', 'provided'],
            ['safeguarding_status', 'provided'],
        ]
        for (const [column, resetValue] of rollbacks) {
            await supabase
                .from('referee_profiles')
                .update({ [column]: resetValue })
                .eq('profile_id', refereeId)
                .eq(column, 'verified')
        }
    }

    if (error) {
        return { error: error.message }
    }

    await logAdminAction({
        actorId: user.id,
        action: verified ? 'referee.verify' : 'referee.unverify',
        summary: verified
            ? 'Verified referee (FA, DBS & Safeguarding)'
            : 'Removed referee verification',
        targetType: 'referee',
        targetId: refereeId,
    })

    revalidatePath('/app/admin/referees')
    revalidatePath(`/app/admin/referees/${refereeId}`)
    revalidatePath('/app/admin/verification')
    revalidatePath('/app/profile')
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

    await logAdminAction({
        actorId: user.id,
        action: 'fa.status',
        summary: `Set FA verification status to "${status}"`,
        targetType: 'referee',
        targetId: refereeId,
        detail: { status },
    })

    revalidatePath('/app/admin/referees')
    revalidatePath(`/app/admin/referees/${refereeId}`)
    revalidatePath('/app/admin/verification')
    revalidatePath('/app/profile')
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

    // Send automated verification email with one-click response buttons
    let emailSent = false
    try {
        const emailResult = await sendFAVerificationEmail({
            refereeName,
            faId: referee.fa_id,
            county: referee.county,
            responseToken: request.response_token,
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

    await logAdminAction({
        actorId: user.id,
        action: 'fa.verification.resolve',
        summary: `${resolution === 'confirmed' ? 'Confirmed' : 'Rejected'} FA verification request`,
        targetType: 'referee',
        targetId: request.referee_id,
        detail: { requestId, resolution, notes: notes || null },
    })

    revalidatePath('/app/admin/referees')
    revalidatePath(`/app/admin/referees/${request.referee_id}`)
    revalidatePath('/app/admin/verification')
    revalidatePath('/app/profile')
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

// ── Platform Settings ────────────────────────────────────────────────────

export async function getPlatformSettings(): Promise<{
    data?: Record<string, string>
    error?: string
}> {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return { error: 'Admin access required' }

    const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value')

    if (error) return { error: error.message }

    const settings: Record<string, string> = {}
    for (const row of data || []) {
        settings[row.key] = row.value
    }

    return { data: settings }
}

export async function updatePlatformSetting(
    key: string,
    value: string,
): Promise<{ success?: boolean; error?: string }> {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return { error: 'Admin access required' }

    // Validate
    if (!key || !value) return { error: 'Key and value are required' }

    if (key === 'travel_cost_per_km_pence') {
        const num = parseInt(value, 10)
        if (isNaN(num) || num < 0 || num > 200) {
            return { error: 'Travel cost must be between 0 and 200 pence per km' }
        }
    }

    const { error } = await supabase
        .from('platform_settings')
        .update({
            value,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
        })
        .eq('key', key)

    if (error) return { error: error.message }

    await logAdminAction({
        actorId: user.id,
        action: 'setting.update',
        summary: `Updated platform setting "${key}" to "${value}"`,
        targetType: 'setting',
        targetId: key,
        detail: { key, value },
    })

    revalidatePath('/app/admin/settings')
    return { success: true }
}

// ── Admin triage aggregator ──────────────────────────────────────────────

export type AdminTriage = {
    pendingFAVerifications: { count: number; oldestAgeHours: number | null; byCounty: Record<string, number> }
    openDisputes: { count: number; oldestAgeHours: number | null }
    stuckEscrow: { count: number }
    failedOrPendingWithdrawals: { count: number }
    dbsExpiringSoon: { count: number }
    webhookFailures24h: { count: number }
    minorsPendingConsent: { awaiting: number; rejected: number }
}

function hoursSince(iso: string | null | undefined): number | null {
    if (!iso) return null
    const ms = Date.now() - new Date(iso).getTime()
    return Math.max(0, Math.round(ms / (1000 * 60 * 60)))
}

/**
 * Single round-trip aggregator for the admin home triage panel.
 * Uses the service-role client so counts cross RLS-restricted tables
 * (webhook_events, withdrawal_requests). Caller must already be admin —
 * there is no role check here because this is invoked from a server
 * page that has guarded the user before calling.
 */
export async function getAdminTriage(): Promise<{ data?: AdminTriage; error?: string }> {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return { error: 'Admin access required' }

    const admin = createAdminClient()
    if (!admin) return { error: 'Service role unavailable' }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const todayStr = now.toISOString().slice(0, 10)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10)

    const [
        faPending,
        disputesOpen,
        stuckEscrowRows,
        withdrawalsBad,
        dbsExpiring,
        webhookFails,
        minorsConsent,
    ] = await Promise.all([
        admin
            .from('fa_verification_requests')
            .select('id, county, requested_at')
            .eq('status', 'awaiting_fa_response'),
        admin
            .from('disputes')
            .select('id, created_at')
            .eq('status', 'open')
            .order('created_at', { ascending: true }),
        admin
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'confirmed')
            .lt('match_date', sevenDaysAgoStr)
            .is('escrow_released_at', null)
            .is('deleted_at', null),
        admin
            .from('withdrawal_requests')
            .select('id', { count: 'exact', head: true })
            .in('status', ['failed', 'pending'])
            .lt('created_at', oneHourAgo.toISOString()),
        admin
            .from('referee_profiles')
            .select('profile_id', { count: 'exact', head: true })
            .gte('dbs_expires_at', todayStr)
            .lte('dbs_expires_at', thirtyDaysAhead.toISOString().slice(0, 10)),
        admin
            .from('webhook_events')
            .select('id', { count: 'exact', head: true })
            .gte('received_at', twentyFourHoursAgo.toISOString())
            .not('error', 'is', null),
        admin
            .from('referee_profiles')
            .select('parental_consent_status')
            .in('parental_consent_status', ['awaiting', 'rejected']),
    ])

    const faRows = faPending.data || []
    const byCounty: Record<string, number> = {}
    let oldestFAAge: number | null = null
    for (const r of faRows) {
        const c = (r.county as string) || 'Unknown'
        byCounty[c] = (byCounty[c] || 0) + 1
        const age = hoursSince(r.requested_at as string | null)
        if (age !== null && (oldestFAAge === null || age > oldestFAAge)) oldestFAAge = age
    }

    const disputeRows = disputesOpen.data || []
    const oldestDisputeAge = disputeRows.length > 0 ? hoursSince(disputeRows[0].created_at as string | null) : null

    const minorRows = minorsConsent.data || []
    const minorsAwaiting = minorRows.filter((r) => r.parental_consent_status === 'awaiting').length
    const minorsRejected = minorRows.filter((r) => r.parental_consent_status === 'rejected').length

    return {
        data: {
            pendingFAVerifications: {
                count: faRows.length,
                oldestAgeHours: oldestFAAge,
                byCounty,
            },
            openDisputes: {
                count: disputeRows.length,
                oldestAgeHours: oldestDisputeAge,
            },
            stuckEscrow: { count: stuckEscrowRows.count || 0 },
            failedOrPendingWithdrawals: { count: withdrawalsBad.count || 0 },
            dbsExpiringSoon: { count: dbsExpiring.count || 0 },
            webhookFailures24h: { count: webhookFails.count || 0 },
            minorsPendingConsent: { awaiting: minorsAwaiting, rejected: minorsRejected },
        },
    }
}

// ── Admin overview analytics (surface-level v1, aggregated from Supabase) ─────

export type TrendPoint = { date: string; value: number }

export type AdminOverview = {
    totals: {
        users: number
        coaches: number
        referees: number
        availableReferees: number
        verifiedReferees: number
        bookingsAll: number
        activeBookings: number
        completedBookings: number
        sosBookings: number
        messages: number
    }
    bookingsByStatus: { status: string; count: number }[]
    /** Share of marketed bookings (pending→completed) that secured a referee. */
    fillRate: number | null
    signups30d: TrendPoint[]
    bookings30d: TrendPoint[]
    deltas: {
        signups7d: number
        signupsDelta: number
        bookings7d: number
        bookingsDelta: number
    }
    money: {
        escrowHeldPence: number
        escrowReleasedAllPence: number
        escrowReleased30dPence: number
    }
    health: {
        serviceRole: boolean
        stripe: boolean
        stripeWebhooks: boolean
        vapid: boolean
        firebase: boolean
        email: boolean
        cronSecret: boolean
    }
    generatedAt: string
}

/** Bucket a list of ISO timestamps into the last `days` daily counts (zero-filled). */
function dailySeries(timestamps: (string | null)[], days: number): TrendPoint[] {
    const buckets = new Map<string, number>()
    const start = new Date()
    start.setUTCHours(0, 0, 0, 0)
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(start.getTime() - i * 86400000)
        buckets.set(d.toISOString().slice(0, 10), 0)
    }
    for (const ts of timestamps) {
        if (!ts) continue
        const day = ts.slice(0, 10)
        if (buckets.has(day)) buckets.set(day, (buckets.get(day) || 0) + 1)
    }
    return Array.from(buckets.entries()).map(([date, value]) => ({ date, value }))
}

/**
 * Surface-level analytics for the admin overview. Aggregates EXISTING tables
 * (no events table) via bounded count() queries + JS bucketing of 30-day
 * timestamp windows. Service-role client so counts cross RLS-restricted tables.
 * Caller is guarded by requireAdmin.
 */
export async function getAdminOverview(): Promise<{ data?: AdminOverview; error?: string }> {
    const supabase = await createClient()
    const user = await requireAdmin(supabase)
    if (!user) return { error: 'Admin access required' }

    const admin = createAdminClient()
    if (!admin) return { error: 'Service role unavailable' }

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 86400000).toISOString()

    const statusCount = (status: string) =>
        admin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', status).is('deleted_at', null)

    const [
        usersC, coachesC, refereesC, availableRefsC, verifiedRefsC,
        bookingsAllC, activeBookingsC, completedC, sosC, messagesC,
        draftC, pendingC, offeredC, confirmedC, cancelledC,
        signupRows, bookingRows, escrowRows,
    ] = await Promise.all([
        admin.from('profiles').select('id', { count: 'exact', head: true }),
        admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'coach'),
        admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'referee'),
        admin.from('referee_profiles').select('profile_id', { count: 'exact', head: true }).eq('is_available', true),
        admin.from('referee_profiles').select('profile_id', { count: 'exact', head: true }).eq('fa_verification_status', 'verified'),
        admin.from('bookings').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        admin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed').gte('match_date', todayStr).is('deleted_at', null),
        statusCount('completed'),
        admin.from('bookings').select('id', { count: 'exact', head: true }).eq('is_sos', true).is('deleted_at', null),
        admin.from('messages').select('id', { count: 'exact', head: true }),
        statusCount('draft'),
        statusCount('pending'),
        statusCount('offered'),
        statusCount('confirmed'),
        statusCount('cancelled'),
        admin.from('profiles').select('created_at').gte('created_at', thirtyDaysAgoIso),
        admin.from('bookings').select('created_at').is('deleted_at', null).gte('created_at', thirtyDaysAgoIso),
        admin.from('bookings').select('escrow_amount_pence, escrow_released_at').not('escrow_amount_pence', 'is', null).is('deleted_at', null),
    ])

    const completedCount = completedC.count || 0
    const confirmedCount = confirmedC.count || 0
    const pendingCount = pendingC.count || 0
    const offeredCount = offeredC.count || 0

    const bookingsByStatus = [
        { status: 'draft', count: draftC.count || 0 },
        { status: 'pending', count: pendingCount },
        { status: 'offered', count: offeredCount },
        { status: 'confirmed', count: confirmedCount },
        { status: 'completed', count: completedCount },
        { status: 'cancelled', count: cancelledC.count || 0 },
    ]

    const reachedMarket = pendingCount + offeredCount + confirmedCount + completedCount
    const fillRate = reachedMarket > 0 ? (confirmedCount + completedCount) / reachedMarket : null

    const signups30d = dailySeries((signupRows.data || []).map((r) => r.created_at as string), 30)
    const bookings30d = dailySeries((bookingRows.data || []).map((r) => r.created_at as string), 30)

    const sum7 = (s: TrendPoint[]) => s.slice(-7).reduce((a, p) => a + p.value, 0)
    const sumPrev7 = (s: TrendPoint[]) => s.slice(-14, -7).reduce((a, p) => a + p.value, 0)
    const signups7d = sum7(signups30d)
    const bookings7d = sum7(bookings30d)

    const thirtyDaysAgoMs = now.getTime() - 30 * 86400000
    let escrowHeldPence = 0
    let escrowReleasedAllPence = 0
    let escrowReleased30dPence = 0
    for (const r of escrowRows.data || []) {
        const amt = (r.escrow_amount_pence as number) || 0
        const released = r.escrow_released_at as string | null
        if (released) {
            escrowReleasedAllPence += amt
            if (new Date(released).getTime() >= thirtyDaysAgoMs) escrowReleased30dPence += amt
        } else {
            escrowHeldPence += amt
        }
    }

    return {
        data: {
            totals: {
                users: usersC.count || 0,
                coaches: coachesC.count || 0,
                referees: refereesC.count || 0,
                availableReferees: availableRefsC.count || 0,
                verifiedReferees: verifiedRefsC.count || 0,
                bookingsAll: bookingsAllC.count || 0,
                activeBookings: activeBookingsC.count || 0,
                completedBookings: completedCount,
                sosBookings: sosC.count || 0,
                messages: messagesC.count || 0,
            },
            bookingsByStatus,
            fillRate,
            signups30d,
            bookings30d,
            deltas: {
                signups7d,
                signupsDelta: signups7d - sumPrev7(signups30d),
                bookings7d,
                bookingsDelta: bookings7d - sumPrev7(bookings30d),
            },
            money: { escrowHeldPence, escrowReleasedAllPence, escrowReleased30dPence },
            health: {
                serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                stripe: !!process.env.STRIPE_SECRET_KEY,
                stripeWebhooks: !!process.env.STRIPE_WEBHOOK_SECRET && !!process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
                vapid: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY,
                firebase: !!process.env.FIREBASE_SERVICE_ACCOUNT,
                email: !!process.env.MAKE_EMAIL_WEBHOOK_URL,
                cronSecret: !!process.env.CRON_SECRET,
            },
            generatedAt: now.toISOString(),
        },
    }
}
