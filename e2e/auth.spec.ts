import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
    test('unauthenticated user is redirected to login', async ({ page }) => {
        await page.goto('/app')
        await page.waitForURL('**/auth/login**')
        await expect(page.locator('text=Sign In')).toBeVisible()
    })

    test('login page loads correctly', async ({ page }) => {
        await page.goto('/auth/login')
        await expect(page.locator('input[type="email"]')).toBeVisible()
        await expect(page.locator('input[type="password"]')).toBeVisible()
    })

    test('register page loads correctly', async ({ page }) => {
        await page.goto('/auth/register')
        await expect(page.locator('input[type="email"]')).toBeVisible()
    })

    test('forgot password page loads correctly', async ({ page }) => {
        await page.goto('/auth/forgot-password')
        await expect(page.locator('input[type="email"]')).toBeVisible()
    })

    test('login with invalid credentials shows error', async ({ page }) => {
        await page.goto('/auth/login')
        await page.fill('input[type="email"]', 'nonexistent@test.com')
        await page.fill('input[type="password"]', 'wrongpassword')
        await page.click('button[type="submit"]')

        // Should show an error message
        await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 10000 })
    })
})
