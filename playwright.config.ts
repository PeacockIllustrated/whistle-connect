import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false, // sequential — tests share state (users, bookings)
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: 'html',
    timeout: 60000,
    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // Uncomment to auto-start dev server:
    // webServer: {
    //     command: 'npm run dev',
    //     url: 'http://localhost:3000',
    //     reuseExistingServer: !process.env.CI,
    // },
})
