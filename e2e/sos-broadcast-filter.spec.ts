/**
 * E2E: regression test for the SOS broadcast filter bug fixed this session.
 *
 * Background: when a coach creates an SOS booking, the system pre-inserts
 * a booking_offers row for every nearby referee with status='sent',
 * price_pence=NULL, responded_at=NULL — purely as the notification
 * delivery mechanism. Before the fix, the referee-side queries (Offers &
 * Fixtures page + Incoming Offers page + real-time refetch) lacked a
 * `price_pence IS NOT NULL OR responded_at IS NOT NULL` filter, so those
 * passive broadcasts surfaced as fake "Awaiting Coach" rows captioned
 * "You tapped I'm Available" — even though the ref never tapped anything.
 *
 * This spec creates exactly such a broadcast row and asserts:
 *   1. /app/bookings (Offers & Fixtures) — broadcast does NOT appear in
 *      the "Awaiting Coach" list.
 *   2. /app/offers (Incoming Offers) — broadcast does NOT render.
 *   3. A legit ref-tapped offer (responded_at stamped) DOES appear.
 *
 * Prerequisites: dev server + seed (see checkin-flow.spec.ts).
 */

import { test, expect } from '@playwright/test'
import {
    admin,
    cleanupBookings,
    createBooking,
    createOffer,
    getUserId,
    login,
} from './helpers'

test.describe('SOS broadcast filter (regression)', () => {
    let coachId: string
    let refereeId: string

    test.beforeAll(async () => {
        coachId = await getUserId('coach')
        refereeId = await getUserId('referee')
    })

    test('passive SOS broadcast row does NOT appear in Awaiting Coach', async ({ page }) => {
        // Build a SOS booking with the exact shape the SOS-create RPC
        // produces in production: status='offered', is_sos=true, with a
        // pre-inserted offer row for the nearby ref.
        const booking = await createBooking(coachId, {
            status: 'offered',
            isSos: true,
            sosExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
            groundName: 'E2E SOS Broadcast Ground',
        })
        const offer = await createOffer({
            bookingId: booking.id,
            refereeId,
            status: 'sent',
            pricePence: null,
            respondedAt: null, // ← the smoking gun
        })

        try {
            await login(page, 'referee')
            await page.goto('/app/bookings')
            await page.waitForLoadState('networkidle')

            // The Awaiting Coach section may or may not render at all
            // depending on whether the ref has other in-flight offers. Either
            // way, our broadcast venue should NOT appear.
            await expect(page.getByText('E2E SOS Broadcast Ground')).toHaveCount(0)

            // Also verify the /app/offers Incoming Offers page filters it.
            await page.goto('/app/offers')
            await page.waitForLoadState('networkidle')
            await expect(page.getByText('E2E SOS Broadcast Ground')).toHaveCount(0)
        } finally {
            await admin.from('booking_offers').delete().eq('id', offer.id)
            await cleanupBookings(booking.id)
        }
    })

    test('legitimately-responded SOS offer DOES appear', async ({ page }) => {
        // Same SOS booking shape, but with responded_at stamped (the ref
        // really did tap Accept SOS Call). This row MUST surface — the
        // filter must not be too aggressive.
        const booking = await createBooking(coachId, {
            status: 'offered',
            isSos: true,
            sosExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
            groundName: 'E2E SOS Accepted Ground',
        })
        const offer = await createOffer({
            bookingId: booking.id,
            refereeId,
            status: 'sent',
            pricePence: null,
            respondedAt: new Date().toISOString(),
        })

        try {
            await login(page, 'referee')
            await page.goto('/app/bookings')
            await page.waitForLoadState('networkidle')

            await expect(page.getByText('E2E SOS Accepted Ground')).toBeVisible({
                timeout: 10_000,
            })
        } finally {
            await admin.from('booking_offers').delete().eq('id', offer.id)
            await cleanupBookings(booking.id)
        }
    })

    test('coach-priced offer (price_pence > 0) DOES appear in New Offers', async ({ page }) => {
        // The other side of the filter: a normal coach-priced offer must
        // render. price_pence > 0 satisfies the OR clause even if
        // responded_at is null (ref hasn't responded yet).
        const booking = await createBooking(coachId, {
            status: 'offered',
            groundName: 'E2E Coach Priced Ground',
        })
        const offer = await createOffer({
            bookingId: booking.id,
            refereeId,
            status: 'sent',
            pricePence: 3500,
            respondedAt: null,
        })

        try {
            await login(page, 'referee')
            await page.goto('/app/bookings')
            await page.waitForLoadState('networkidle')

            await expect(page.getByText('E2E Coach Priced Ground')).toBeVisible({
                timeout: 10_000,
            })
        } finally {
            await admin.from('booking_offers').delete().eq('id', offer.id)
            await cleanupBookings(booking.id)
        }
    })
})
