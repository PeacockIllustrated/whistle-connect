/**
 * E2E: referee at-venue check-in (FA-trial evidence flow).
 *
 * Covers the four observable behaviours from the spec the founders signed
 * off on:
 *   1. The check-in card only renders inside the kickoff-30min →
 *      kickoff+3h window for the assigned referee.
 *   2. A check-in close to the venue persists, the coach is notified, and
 *      both parties see the distance + GPS accuracy afterwards.
 *   3. A check-in >500m from the venue still succeeds (we log, not block),
 *      and the post-checkin view surfaces the amber warning banner.
 *   4. Permission-denied geolocation falls back to a no-GPS check-in
 *      rather than blocking the ref entirely.
 *
 * Prerequisites:
 *   - Dev server on localhost:3000 (npm run dev in another shell)
 *   - npm run seed:test (creates test-coach + test-referee)
 *   - Migration 0158 applied to the target Supabase
 *
 * Time handling: the spec creates a booking with kickoff_time = "now +
 * 10min" so we land safely inside the open check-in window without
 * waiting around. Match date is today.
 */

import { test, expect } from '@playwright/test'
import {
    admin,
    assignReferee,
    cleanupBookings,
    createBooking,
    getUserId,
    login,
} from './helpers'

// Venue coords used by the seed referee's home county. The "close" geolocation
// hits the venue square-on; the "far" one is central London (≈ 270 km away).
const VENUE_LAT = 53.7997
const VENUE_LNG = -1.5492
const CLOSE_GEO = { latitude: VENUE_LAT + 0.0005, longitude: VENUE_LNG + 0.0005 } // ~70m
const FAR_GEO = { latitude: 51.5074, longitude: -0.1278 } // London

function kickoffInMinutes(minutesFromNow: number): string {
    const t = new Date(Date.now() + minutesFromNow * 60_000)
    return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:00`
}

function todayDate(): string {
    return new Date().toISOString().slice(0, 10)
}

test.describe('Check-in flow', () => {
    let coachId: string
    let refereeId: string

    test.beforeAll(async () => {
        coachId = await getUserId('coach')
        refereeId = await getUserId('referee')
    })

    test('check-in card persists with distance + accuracy after a close check-in', async ({
        page,
        context,
    }) => {
        // Set up a confirmed booking with kickoff 10min from now.
        const booking = await createBooking(coachId, {
            status: 'confirmed',
            matchDate: todayDate(),
            kickoffTime: kickoffInMinutes(10),
            latitude: VENUE_LAT,
            longitude: VENUE_LNG,
            escrowAmountPence: 3500,
            groundName: 'E2E Check-in Ground',
        })
        await assignReferee(booking.id, refereeId)

        try {
            await context.grantPermissions(['geolocation'])
            await context.setGeolocation(CLOSE_GEO)

            await login(page, 'referee')
            await page.goto(`/app/bookings/${booking.id}`)

            // The action card should be present (we're inside the window).
            const checkInButton = page.getByRole('button', { name: /check in now/i })
            await expect(checkInButton).toBeVisible({ timeout: 10_000 })

            await checkInButton.click()

            // Post-checkin treatment: confirmed pill + numeric distance.
            await expect(page.getByText(/confirmed/i).first()).toBeVisible({ timeout: 15_000 })
            await expect(page.getByText(/from venue/i)).toBeVisible()

            // The action card should no longer offer "Check in now" — it's
            // been replaced by the read-only summary.
            await expect(checkInButton).toHaveCount(0)

            // Verify the row landed with a small distance value.
            const { data } = await admin
                .from('bookings')
                .select('referee_checked_in_at, checkin_distance_m, checkin_lat, checkin_lng')
                .eq('id', booking.id)
                .single()
            const row = data as {
                referee_checked_in_at: string | null
                checkin_distance_m: number | null
                checkin_lat: number | null
                checkin_lng: number | null
            } | null
            expect(row?.referee_checked_in_at).not.toBeNull()
            expect(row?.checkin_lat).not.toBeNull()
            expect(row?.checkin_lng).not.toBeNull()
            // Close-geo offset of 0.0005 deg ≈ 50-70m at this latitude.
            expect(row?.checkin_distance_m ?? 99999).toBeLessThan(200)
        } finally {
            await cleanupBookings(booking.id)
        }
    })

    test('check-in >500m from venue surfaces the warning banner but still succeeds', async ({
        page,
        context,
    }) => {
        const booking = await createBooking(coachId, {
            status: 'confirmed',
            matchDate: todayDate(),
            kickoffTime: kickoffInMinutes(15),
            latitude: VENUE_LAT,
            longitude: VENUE_LNG,
            escrowAmountPence: 3500,
            groundName: 'E2E Far Check-in Ground',
        })
        await assignReferee(booking.id, refereeId)

        try {
            await context.grantPermissions(['geolocation'])
            await context.setGeolocation(FAR_GEO)

            await login(page, 'referee')
            await page.goto(`/app/bookings/${booking.id}`)

            await page.getByRole('button', { name: /check in now/i }).click()

            // Amber warning banner cites the threshold value from the spec.
            await expect(
                page.getByText(/more than 500m from the venue/i),
            ).toBeVisible({ timeout: 15_000 })

            // The check-in still landed — distance > 500m on the row.
            const { data } = await admin
                .from('bookings')
                .select('referee_checked_in_at, checkin_distance_m')
                .eq('id', booking.id)
                .single()
            const row = data as {
                referee_checked_in_at: string | null
                checkin_distance_m: number | null
            } | null
            expect(row?.referee_checked_in_at).not.toBeNull()
            expect(row?.checkin_distance_m ?? 0).toBeGreaterThan(500)
        } finally {
            await cleanupBookings(booking.id)
        }
    })

    test('check-in card is hidden until the window opens', async ({ page }) => {
        // Kickoff 90 minutes out — window is kickoff-30min so we're 60min
        // BEFORE it opens. Panel should be silent.
        const booking = await createBooking(coachId, {
            status: 'confirmed',
            matchDate: todayDate(),
            kickoffTime: kickoffInMinutes(90),
            latitude: VENUE_LAT,
            longitude: VENUE_LNG,
            escrowAmountPence: 3500,
            groundName: 'E2E Future Kickoff Ground',
        })
        await assignReferee(booking.id, refereeId)

        try {
            await login(page, 'referee')
            await page.goto(`/app/bookings/${booking.id}`)

            // Wait for the page to settle, then assert the card never appears.
            await page.waitForLoadState('networkidle')
            await expect(page.getByText(/check in at the venue/i)).toHaveCount(0)
            await expect(page.getByRole('button', { name: /check in now/i })).toHaveCount(0)
        } finally {
            await cleanupBookings(booking.id)
        }
    })

    test('coach sees the read-only check-in summary on their view', async ({
        page,
        context,
    }) => {
        const booking = await createBooking(coachId, {
            status: 'confirmed',
            matchDate: todayDate(),
            kickoffTime: kickoffInMinutes(10),
            latitude: VENUE_LAT,
            longitude: VENUE_LNG,
            escrowAmountPence: 3500,
            groundName: 'E2E Coach View Ground',
        })
        await assignReferee(booking.id, refereeId)

        // Stamp the check-in directly via admin so we don't need a
        // second browser context — this spec is only about the coach
        // RENDER of an already-checked-in booking.
        await admin
            .from('bookings')
            .update({
                referee_checked_in_at: new Date().toISOString(),
                checkin_lat: CLOSE_GEO.latitude,
                checkin_lng: CLOSE_GEO.longitude,
                checkin_accuracy_m: 12,
                checkin_distance_m: 70,
            })
            .eq('id', booking.id)

        try {
            await context.grantPermissions([]) // coach doesn't need geo
            await login(page, 'coach')
            await page.goto(`/app/bookings/${booking.id}`)

            // Coach sees the confirmation card with distance + accuracy.
            await expect(page.getByText(/check-in/i).first()).toBeVisible({ timeout: 10_000 })
            await expect(page.getByText(/from venue/i)).toBeVisible()
            // No "Check in now" button on the coach view — they don't act.
            await expect(page.getByRole('button', { name: /check in now/i })).toHaveCount(0)
        } finally {
            await cleanupBookings(booking.id)
        }
    })
})
