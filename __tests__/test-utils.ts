/**
 * Test utilities for Whistle Connect.
 *
 * Uses the Supabase admin (service_role) client to bypass RLS and
 * set up / tear down test data. These helpers are NOT server actions —
 * they talk directly to Supabase, so they work in Vitest without Next.js.
 */

import { createClient } from '@supabase/supabase-js'

// ── Admin client (bypasses RLS) ──────────────────────────────────────

let _adminClient: ReturnType<typeof createClient> | null = null

function getAdminClient() {
    if (_adminClient) return _adminClient

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. ' +
            'Make sure .env.local is loaded (see __tests__/setup.ts).'
        )
    }
    _adminClient = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    return _adminClient
}

/** Lazy-initialized admin client — only created on first access (after env is loaded). */
export const adminClient = new Proxy({} as ReturnType<typeof createClient>, {
    get(_target, prop) {
        return (getAdminClient() as Record<string | symbol, unknown>)[prop]
    },
})

// ── Types ────────────────────────────────────────────────────────────

export interface TestUser {
    id: string
    email: string
    role: 'coach' | 'referee' | 'admin'
}

export interface TestBooking {
    id: string
    coach_id: string
    status: string
}

// ── User factory ─────────────────────────────────────────────────────

const createdUserIds: string[] = []

/**
 * Create a test user with a profile.
 * Uses Supabase admin auth to create the user, then inserts a profile row.
 */
export async function createTestUser(
    role: 'coach' | 'referee' | 'admin',
    overrides?: { email?: string; fullName?: string },
): Promise<TestUser> {
    const suffix = Math.random().toString(36).slice(2, 8)
    const email = overrides?.email || `test-${role}-${suffix}@whistle-test.local`
    const fullName = overrides?.fullName || `Test ${role} ${suffix}`

    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: 'TestPassword123!',
        email_confirm: true,
    })

    if (authError) throw new Error(`createTestUser auth: ${authError.message}`)
    const userId = authData.user.id
    createdUserIds.push(userId)

    // Create profile (email lives on auth.users, not profiles)
    const { error: profileError } = await adminClient.from('profiles').upsert({
        id: userId,
        full_name: fullName,
        role,
    })

    if (profileError) throw new Error(`createTestUser profile: ${profileError.message}`)

    // If referee, create referee_profile
    if (role === 'referee') {
        const { error: refError } = await adminClient.from('referee_profiles').upsert({
            profile_id: userId,
            county: 'Yorkshire',
            level: '7',
            verified: true,
            is_available: true,
            fa_verification_status: 'verified',
            dbs_status: 'verified',
            travel_radius_km: 30,
        })
        if (refError) throw new Error(`createTestUser referee_profile: ${refError.message}`)
    }

    return { id: userId, email, role }
}

/**
 * Create a referee with a specific DBS status (for testing DBS enforcement).
 */
export async function createTestRefereeWithDBS(
    dbsStatus: 'verified' | 'not_provided' | 'provided' | 'expired',
): Promise<TestUser> {
    const user = await createTestUser('referee')

    await adminClient.from('referee_profiles').update({
        dbs_status: dbsStatus,
    }).eq('profile_id', user.id)

    return user
}

// ── Booking factory ──────────────────────────────────────────────────

const createdBookingIds: string[] = []

/**
 * Create a test booking for a coach.
 */
export async function createTestBooking(
    coachId: string,
    overrides?: Partial<{
        status: string
        ageGroup: string
        matchDate: string
        kickoffTime: string
        postcode: string
    }>,
): Promise<TestBooking> {
    const { data, error } = await adminClient.from('bookings').insert({
        coach_id: coachId,
        match_date: overrides?.matchDate || '2026-05-01',
        kickoff_time: overrides?.kickoffTime || '14:00:00',
        location_postcode: overrides?.postcode || 'LS1 1BA',
        county: 'Yorkshire',
        ground_name: 'Test Ground',
        age_group: overrides?.ageGroup || 'adult',
        format: '11v11',
        competition_type: 'league',
        status: overrides?.status || 'pending',
    }).select().single()

    if (error) throw new Error(`createTestBooking: ${error.message}`)
    createdBookingIds.push(data.id)

    return { id: data.id, coach_id: coachId, status: data.status }
}

/**
 * Create a test offer on a booking.
 */
export async function createTestOffer(
    bookingId: string,
    refereeId: string,
    overrides?: Partial<{
        status: string
        pricePence: number
        matchFeePence: number
        travelCostPence: number
        travelDistanceKm: number
    }>,
) {
    const { data, error } = await adminClient.from('booking_offers').insert({
        booking_id: bookingId,
        referee_id: refereeId,
        status: overrides?.status || 'sent',
        price_pence: overrides?.pricePence || 3500,
        match_fee_pence: overrides?.matchFeePence || 3000,
        travel_cost_pence: overrides?.travelCostPence || 500,
        travel_distance_km: overrides?.travelDistanceKm || 17.9,
        currency: 'GBP',
    }).select().single()

    if (error) throw new Error(`createTestOffer: ${error.message}`)
    return data
}

// ── Wallet factory ───────────────────────────────────────────────────

/**
 * Create a wallet for a user with a specific balance.
 */
export async function createTestWallet(
    userId: string,
    balancePence: number = 10000,
) {
    const { data, error } = await adminClient.from('wallets').upsert({
        user_id: userId,
        balance_pence: balancePence,
        escrow_pence: 0,
    }, { onConflict: 'user_id' }).select().single()

    if (error) throw new Error(`createTestWallet: ${error.message}`)
    return data
}

// ── Platform settings ────────────────────────────────────────────────

/**
 * Set a platform setting (admin bypass).
 */
export async function setPlatformSetting(key: string, value: string) {
    const { error } = await adminClient.from('platform_settings').upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

    if (error) throw new Error(`setPlatformSetting: ${error.message}`)
}

// ── Cleanup ──────────────────────────────────────────────────────────

/**
 * Delete all test data created during this test run.
 * Call in afterAll() or afterEach().
 */
export async function cleanupTestData() {
    // Delete bookings (cascades to offers, assignments)
    if (createdBookingIds.length > 0) {
        await adminClient.from('bookings').delete().in('id', createdBookingIds)
        createdBookingIds.length = 0
    }

    // Delete users (cascades to profiles, wallets, etc.)
    for (const id of createdUserIds) {
        // Delete profile and related data first
        await adminClient.from('wallets').delete().eq('user_id', id)
        await adminClient.from('referee_profiles').delete().eq('profile_id', id)
        await adminClient.from('profiles').delete().eq('id', id)
        await adminClient.auth.admin.deleteUser(id)
    }
    createdUserIds.length = 0
}
