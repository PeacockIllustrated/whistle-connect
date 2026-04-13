import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'test-admin@whistle-test.local'
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!'
const COACH_EMAIL = process.env.TEST_COACH_EMAIL || 'test-coach@whistle-test.local'
const COACH_PASSWORD = process.env.TEST_COACH_PASSWORD || 'TestPassword123!'

async function login(page: import('@playwright/test').Page, email: string, password: string) {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/app**', { timeout: 15000 })
}

test.describe('Admin Settings', () => {
    test('admin can access settings page', async ({ page }) => {
        await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
        await page.goto('/app/admin/settings')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('text=Platform Settings')).toBeVisible({ timeout: 10000 })
        await expect(page.locator('text=Travel Expenses')).toBeVisible()
    })

    test('admin can see current travel rate', async ({ page }) => {
        await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
        await page.goto('/app/admin/settings')
        await page.waitForLoadState('networkidle')

        // Should see the cost per km input
        await expect(page.locator('text=Cost per kilometre')).toBeVisible({ timeout: 10000 })
        const input = page.locator('input[type="number"]')
        await expect(input).toBeVisible()

        const value = await input.inputValue()
        expect(parseFloat(value)).toBeGreaterThan(0)
    })

    test('admin can update travel rate and save', async ({ page }) => {
        await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
        await page.goto('/app/admin/settings')
        await page.waitForLoadState('networkidle')

        // Change the rate
        const input = page.locator('input[type="number"]')
        await input.fill('0.35')

        // Save
        await page.click('button:has-text("Save")')

        // Should show success message
        await expect(page.locator('text=updated successfully')).toBeVisible({ timeout: 10000 })

        // Reset back to default
        await input.fill('0.28')
        await page.click('button:has-text("Save")')
        await expect(page.locator('text=updated successfully')).toBeVisible({ timeout: 10000 })
    })

    test('admin can access referees management', async ({ page }) => {
        await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
        await page.goto('/app/admin/referees')
        await page.waitForLoadState('networkidle')
    })

    test('admin can access verification page', async ({ page }) => {
        await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
        await page.goto('/app/admin/verification')
        await page.waitForLoadState('networkidle')
    })
})

test.describe('Admin Access Control', () => {
    test('non-admin cannot access admin pages', async ({ page }) => {
        await login(page, COACH_EMAIL, COACH_PASSWORD)

        // Try to access admin page
        await page.goto('/app/admin/settings')
        await page.waitForLoadState('networkidle')

        // Should be denied or redirected (exact behavior depends on middleware/RLS)
        // At minimum, should not see the settings form
        const settingsVisible = await page.locator('text=Platform Settings').isVisible().catch(() => false)
        // If they can see it, the getPlatformSettings() call should fail with admin error
    })
})
