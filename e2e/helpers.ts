/**
 * Shared helpers for Playwright e2e specs.
 *
 * - login(page, role) — drives the auth form using the seeded test users
 *   (scripts/seed-test-users.ts). Throws if the user doesn't exist.
 * - admin — service-role Supabase client, bypasses RLS. Use to set up
 *   per-spec bookings, offers, etc. Mirrors __tests__/test-utils.ts.
 * - test booking factories — return the inserted row; specs are
 *   responsible for cleaning up via cleanupBookings(...).
 *
 * Each spec should pair createTestBooking() etc. with a cleanup in
 * afterAll/afterEach so the next run starts from a known state.
 */

import { config } from 'dotenv'
import type { Page } from '@playwright/test'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { TEST_COACH, TEST_REFEREE } from '../scripts/seed-test-users'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
        'e2e helpers require NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local',
    )
}

export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
})

// ── Auth ───────────────────────────────────────────────────────────────

export async function login(page: Page, role: 'coach' | 'referee') {
    const identity = role === 'coach' ? TEST_COACH : TEST_REFEREE
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', identity.email)
    await page.fill('input[type="password"]', identity.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/app**', { timeout: 15_000 })
}

/** Look up the auth UUID for the seeded coach / referee. Cached after first call. */
const userIdCache: Record<string, string> = {}
export async function getUserId(role: 'coach' | 'referee'): Promise<string> {
    if (userIdCache[role]) return userIdCache[role]
    const email = role === 'coach' ? TEST_COACH.email : TEST_REFEREE.email
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const u = (data.users as Array<{ id: string; email: string | null }>).find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
    )
    if (!u) throw new Error(`No seeded user for role=${role} (${email}). Run npm run seed:test.`)
    userIdCache[role] = u.id
    return u.id
}

// ── Booking factories ──────────────────────────────────────────────────

interface BookingOverrides {
    status?: 'pending' | 'offered' | 'confirmed' | 'completed' | 'cancelled'
    bookingType?: 'individual' | 'central' | 'tournament'
    matchDate?: string // YYYY-MM-DD
    kickoffTime?: string // HH:MM:SS
    isSos?: boolean
    sosExpiresAt?: string // ISO
    latitude?: number
    longitude?: number
    groundName?: string
    postcode?: string
    escrowAmountPence?: number
    tournamentName?: string
    budgetPounds?: number
    ageGroup?: string
}

export async function createBooking(
    coachId: string,
    overrides: BookingOverrides = {},
): Promise<{ id: string }> {
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await admin
        .from('bookings')
        .insert({
            coach_id: coachId,
            match_date: overrides.matchDate ?? today,
            kickoff_time: overrides.kickoffTime ?? '14:00:00',
            location_postcode: overrides.postcode ?? 'LS1 1BA',
            county: 'Yorkshire',
            ground_name: overrides.groundName ?? 'Test Ground',
            address_text: overrides.groundName ?? 'Test Ground',
            age_group: overrides.ageGroup ?? 'adult',
            format: '11v11',
            competition_type: 'league',
            status: overrides.status ?? 'pending',
            booking_type: overrides.bookingType ?? 'individual',
            is_sos: overrides.isSos ?? false,
            sos_expires_at: overrides.sosExpiresAt ?? null,
            latitude: overrides.latitude ?? 53.7997, // Leeds centre
            longitude: overrides.longitude ?? -1.5492,
            escrow_amount_pence: overrides.escrowAmountPence ?? null,
            tournament_name: overrides.tournamentName ?? null,
            budget_pounds: overrides.budgetPounds ?? 35,
        })
        .select('id')
        .single()
    if (error) throw new Error(`createBooking: ${error.message}`)
    return { id: (data as { id: string }).id }
}

export async function assignReferee(bookingId: string, refereeId: string) {
    const { error } = await admin
        .from('booking_assignments')
        .upsert(
            { booking_id: bookingId, referee_id: refereeId },
            { onConflict: 'booking_id' },
        )
    if (error) throw new Error(`assignReferee: ${error.message}`)
}

interface OfferOverrides {
    status?: 'sent' | 'accepted' | 'declined' | 'withdrawn' | 'accepted_priced'
    pricePence?: number | null
    respondedAt?: string | null
    bookingId: string
    refereeId: string
}

export async function createOffer(opts: OfferOverrides): Promise<{ id: string }> {
    const { data, error } = await admin
        .from('booking_offers')
        .insert({
            booking_id: opts.bookingId,
            referee_id: opts.refereeId,
            status: opts.status ?? 'sent',
            price_pence: opts.pricePence ?? null,
            responded_at: opts.respondedAt ?? null,
            currency: 'GBP',
        })
        .select('id')
        .single()
    if (error) throw new Error(`createOffer: ${error.message}`)
    return { id: (data as { id: string }).id }
}

// ── Cleanup ────────────────────────────────────────────────────────────

export async function cleanupBookings(...ids: string[]) {
    if (ids.length === 0) return
    await admin.from('bookings').delete().in('id', ids)
}

/** Reset the referee opt-in flags + central/tournament toggles back to false. */
export async function resetRefereeOptIns(refereeId: string) {
    await admin
        .from('referee_profiles')
        .update({ central_venue_opt_in: false, tournament_opt_in: false })
        .eq('profile_id', refereeId)
}
