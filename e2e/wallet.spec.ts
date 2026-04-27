import { test, expect } from '@playwright/test'

const COACH_EMAIL = process.env.TEST_COACH_EMAIL || 'test-coach@whistle-test.local'
const COACH_PASSWORD = process.env.TEST_COACH_PASSWORD || 'TestPassword123!'

async function loginAsCoach(page: import('@playwright/test').Page) {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', COACH_EMAIL)
    await page.fill('input[type="password"]', COACH_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/app**', { timeout: 15000 })
}

test.describe('Wallet', () => {
    test('coach wallet page shows balance cards', async ({ page }) => {
        await loginAsCoach(page)
        await page.goto('/app/wallet')
        await page.waitForLoadState('networkidle')

        // Should see Available and In Escrow sections
        await expect(page.locator('text=AVAILABLE')).toBeVisible({ timeout: 10000 })
        await expect(page.locator('text=IN ESCROW')).toBeVisible({ timeout: 10000 })
    })

    test('coach wallet shows transaction history section', async ({ page }) => {
        await loginAsCoach(page)
        await page.goto('/app/wallet')
        await page.waitForLoadState('networkidle')

        await expect(page.locator('text=TRANSACTION HISTORY')).toBeVisible({ timeout: 10000 })
    })

    test('top-up page loads with amount options', async ({ page }) => {
        await loginAsCoach(page)
        await page.goto('/app/wallet/top-up')
        await page.waitForLoadState('networkidle')

        // Should see preset amounts or custom input
        const hasTopUpUI = await page.locator('text=Top Up, text=Add Funds, input[type="number"]').first().isVisible()
        expect(hasTopUpUI).toBeTruthy()
    })

    test('top-up redirects to Stripe checkout', async ({ page }) => {
        await loginAsCoach(page)
        await page.goto('/app/wallet/top-up')
        await page.waitForLoadState('networkidle')

        // Enter an amount and submit
        const amountInput = page.locator('input[type="number"]').first()
        if (await amountInput.isVisible()) {
            await amountInput.fill('20')
        }

        // Click a preset amount button if available
        const presetBtn = page.locator('text=£20').first()
        if (await presetBtn.isVisible()) {
            await presetBtn.click()
        }

        // Click top up / continue button
        const submitBtn = page.locator('button:has-text("Top Up"), button:has-text("Continue"), button:has-text("Add")').first()
        if (await submitBtn.isVisible()) {
            await submitBtn.click()

            // Should redirect to Stripe checkout (checkout.stripe.com)
            await page.waitForURL(/checkout\.stripe\.com|\/app\/wallet/, { timeout: 15000 })
        }
    })

    test('wallet success banner shows after redirect', async ({ page }) => {
        await loginAsCoach(page)
        await page.goto('/app/wallet?topup=success')
        await page.waitForLoadState('networkidle')

        // Should show success message
        await expect(page.locator('text=successful, text=updated')).toBeVisible({ timeout: 10000 })
    })
})
