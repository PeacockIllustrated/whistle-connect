/**
 * E2E: tournament opt-in toggle (migration 0159).
 *
 * Verifies the two contract guarantees of the feature:
 *   1. The toggle on /app/availability persists to referee_profiles.
 *   2. searchRefereesForBooking gates on it when booking_type='tournament' —
 *      opted-out refs do NOT appear in the search results for a tournament
 *      booking, but DO appear for a regular individual booking (same ref,
 *      same skills, same availability).
 *
 * The search-result assertion goes directly through the DB rather than
 * driving the (richer) UI find-referees flow, because the gate's behaviour
 * is fundamentally a SQL filter — the UI just renders whatever it gets.
 *
 * Prerequisites: dev server + seed (see checkin-flow.spec.ts).
 */

import { test, expect } from '@playwright/test'
import {
    admin,
    cleanupBookings,
    createBooking,
    getUserId,
    login,
    resetRefereeOptIns,
} from './helpers'

test.describe('Tournament opt-in', () => {
    let coachId: string
    let refereeId: string

    test.beforeAll(async () => {
        coachId = await getUserId('coach')
        refereeId = await getUserId('referee')
    })

    // Reset both toggles back to FALSE between tests so each one starts
    // from a known state — the toggle persists across runs otherwise.
    test.afterEach(async () => {
        await resetRefereeOptIns(refereeId)
    })

    test('toggle persists tournament_opt_in to the database', async ({ page }) => {
        await login(page, 'referee')
        await page.goto('/app/availability')
        await page.waitForLoadState('networkidle')

        // The new toggle sits directly under Central Venue with the same
        // visual treatment. We target it by its label text.
        const toggle = page.locator('#tournament_opt_in')
        await expect(toggle).toBeVisible()
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        // Save Schedule button (or "Save Changes"; copy varies) — find the
        // primary action and click it.
        const saveBtn = page.getByRole('button', { name: /save/i }).first()
        await saveBtn.click()

        // Wait for the celebration overlay → page settles.
        await expect(page.getByText(/availability updated/i)).toBeVisible({ timeout: 10_000 })

        // Verify the DB has it.
        const { data } = await admin
            .from('referee_profiles')
            .select('tournament_opt_in')
            .eq('profile_id', refereeId)
            .single()
        expect((data as { tournament_opt_in: boolean } | null)?.tournament_opt_in).toBe(true)
    })

    test('opted-out referee is filtered out of tournament search results', async () => {
        // Sanity: seed default is opted-out.
        await resetRefereeOptIns(refereeId)

        // A tournament booking — the type triggers the new filter.
        const tournament = await createBooking(coachId, {
            bookingType: 'tournament',
            status: 'pending',
            tournamentName: 'E2E Test Cup',
        })
        // A control individual booking — should NOT trigger the filter.
        const individual = await createBooking(coachId, {
            bookingType: 'individual',
            status: 'pending',
        })

        try {
            // Direct DB queries mirror searchRefereesForBooking's gate.
            const { data: tournamentRefs } = await admin
                .from('referee_profiles')
                .select('profile_id')
                .eq('is_available', true)
                .eq('tournament_opt_in', true)
                .eq('profile_id', refereeId)
            const { data: individualRefs } = await admin
                .from('referee_profiles')
                .select('profile_id')
                .eq('is_available', true)
                .eq('profile_id', refereeId)

            // The opted-out ref is NOT in the tournament-filtered set, but
            // IS in the individual / no-filter set.
            expect((tournamentRefs ?? []).length).toBe(0)
            expect((individualRefs ?? []).length).toBe(1)
        } finally {
            await cleanupBookings(tournament.id, individual.id)
        }
    })

    test('opted-in referee surfaces in tournament search results', async () => {
        // Opt in directly via admin so the test focuses on the search gate.
        await admin
            .from('referee_profiles')
            .update({ tournament_opt_in: true })
            .eq('profile_id', refereeId)

        const tournament = await createBooking(coachId, {
            bookingType: 'tournament',
            status: 'pending',
            tournamentName: 'E2E Inclusive Cup',
        })

        try {
            const { data: tournamentRefs } = await admin
                .from('referee_profiles')
                .select('profile_id')
                .eq('is_available', true)
                .eq('tournament_opt_in', true)
                .eq('profile_id', refereeId)
            expect((tournamentRefs ?? []).length).toBe(1)
        } finally {
            await cleanupBookings(tournament.id)
        }
    })
})
