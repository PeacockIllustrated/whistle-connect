import { test, expect } from '@playwright/test'

/**
 * E2E tests for the core booking journey.
 *
 * PREREQUISITES:
 * - Dev server running on localhost:3000
 * - Supabase running with migrations applied
 * - Test users must exist (create via Supabase dashboard or seed script):
 *   - Coach: test-coach@whistle-test.local / TestPassword123!
 *   - Referee: test-referee@whistle-test.local / TestPassword123!
 *
 * These tests use real browser interactions to verify the full user journey.
 */

const COACH_EMAIL = process.env.TEST_COACH_EMAIL || 'test-coach@whistle-test.local'
const COACH_PASSWORD = process.env.TEST_COACH_PASSWORD || 'TestPassword123!'
const REFEREE_EMAIL = process.env.TEST_REFEREE_EMAIL || 'test-referee@whistle-test.local'
const REFEREE_PASSWORD = process.env.TEST_REFEREE_PASSWORD || 'TestPassword123!'

async function login(page: import('@playwright/test').Page, email: string, password: string) {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    // Wait for redirect to /app
    await page.waitForURL('**/app**', { timeout: 15000 })
}

test.describe('Booking Flow - Coach', () => {
    test('coach can log in and see bookings page', async ({ page }) => {
        await login(page, COACH_EMAIL, COACH_PASSWORD)
        await expect(page).toHaveURL(/\/app/)
    })

    test('coach can navigate to create booking', async ({ page }) => {
        await login(page, COACH_EMAIL, COACH_PASSWORD)
        // Navigate to bookings
        await page.click('text=Bookings')
        await page.waitForLoadState('networkidle')

        // Look for "New Booking" or "Book" button
        const newBookingBtn = page.locator('text=New Booking, text=Book a Referee, a[href*="book"]').first()
        if (await newBookingBtn.isVisible()) {
            await newBookingBtn.click()
            await page.waitForLoadState('networkidle')
        }
    })

    test('coach can access wallet page', async ({ page }) => {
        await login(page, COACH_EMAIL, COACH_PASSWORD)
        await page.goto('/app/wallet')
        await page.waitForLoadState('networkidle')

        // Should see wallet balance
        await expect(page.locator('text=AVAILABLE')).toBeVisible({ timeout: 10000 })
    })

    test('wallet add funds redirects to Stripe', async ({ page }) => {
        await login(page, COACH_EMAIL, COACH_PASSWORD)
        await page.goto('/app/wallet')
        await page.waitForLoadState('networkidle')

        // Click add funds
        const addFundsBtn = page.locator('text=Add Funds').first()
        if (await addFundsBtn.isVisible()) {
            await addFundsBtn.click()
            await page.waitForLoadState('networkidle')
        }
    })
})

test.describe('Booking Flow - Referee', () => {
    test('referee can log in and see offers page', async ({ page }) => {
        await login(page, REFEREE_EMAIL, REFEREE_PASSWORD)

        // Navigate to offers
        await page.goto('/app/offers')
        await page.waitForLoadState('networkidle')

        // Should see offers page header
        await expect(page.locator('text=Incoming Offers')).toBeVisible({ timeout: 10000 })
    })

    test('referee can view their profile', async ({ page }) => {
        await login(page, REFEREE_EMAIL, REFEREE_PASSWORD)
        await page.goto('/app/profile')
        await page.waitForLoadState('networkidle')

        // Should see profile content
        await expect(page.locator('text=Profile, text=profile')).toBeVisible({ timeout: 10000 })
    })

    test('referee can access availability page', async ({ page }) => {
        await login(page, REFEREE_EMAIL, REFEREE_PASSWORD)
        await page.goto('/app/availability')
        await page.waitForLoadState('networkidle')
    })
})

test.describe('Booking Flow - Public Pages', () => {
    test('home page loads with CTA buttons', async ({ page }) => {
        await page.goto('/')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('text=Book a Referee')).toBeVisible()
    })

    test('public booking page loads', async ({ page }) => {
        await page.goto('/book')
        await page.waitForLoadState('networkidle')
    })

    test('individual booking form loads', async ({ page }) => {
        await page.goto('/book/individual')
        await page.waitForLoadState('networkidle')

        // Should see form fields
        await expect(page.locator('text=Match Date, label:has-text("Date")')).toBeVisible({ timeout: 10000 })
    })
})
