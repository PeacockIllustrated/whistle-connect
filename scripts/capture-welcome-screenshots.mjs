/**
 * Captures mobile-viewport screenshots of the running app for the /welcome page.
 * Run: node scripts/capture-welcome-screenshots.mjs
 *
 * Requires the dev server running on http://localhost:3001 with a working .env.local.
 * Set BASE_URL env var to override.
 */
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001'
const OUT_DIR = path.resolve('public/assets/screenshots')

const COACH = { email: 'tom@coach.com', password: 'Jacktom1' }
const REFEREE = { email: 'tom@referee.com', password: 'Jacktom1' }

// iPhone 15 viewport — matches the phone-mockup framing on /welcome
const VIEWPORT = { width: 390, height: 844 }
const DEVICE_SCALE = 3 // retina

async function login(page, { email, password }) {
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    await Promise.all([
        page.waitForURL((url) => !url.pathname.includes('/auth/'), { timeout: 30_000 }),
        page.click('button[type="submit"]'),
    ])
    // Belt-and-braces: wait for any client hydration
    await page.waitForLoadState('networkidle').catch(() => {})
}

async function logout(page) {
    // Best-effort: clear cookies so the next login is clean.
    await page.context().clearCookies()
}

async function shoot(page, urlPath, filename, { wait = 1000 } = {}) {
    await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})
    if (wait) await page.waitForTimeout(wait)
    const out = path.join(OUT_DIR, filename)
    await page.screenshot({ path: out, fullPage: false })
    console.log(`  saved ${path.relative(process.cwd(), out)}`)
}

async function main() {
    await fs.mkdir(OUT_DIR, { recursive: true })

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: DEVICE_SCALE,
        isMobile: true,
        hasTouch: true,
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })

    // Suppress the PWA install nag on every page load.
    await context.addInitScript(() => {
        try {
            localStorage.setItem('install_prompt_dismissed', String(Date.now()))
        } catch {}
    })

    const page = await context.newPage()

    try {
        console.log('→ Coach session')
        await login(page, COACH)
        await shoot(page, '/app', 'coach-dashboard.png')
        await shoot(page, '/app/bookings', 'coach-bookings.png')
        await shoot(page, '/app/bookings/new', 'coach-search.png')
        await logout(page)

        console.log('→ Referee session')
        await login(page, REFEREE)
        await shoot(page, '/app/offers', 'referee-offers.png')
        await shoot(page, '/app/earnings', 'referee-earnings.png')
        await shoot(page, '/app/feed', 'referee-feed.png')
        await logout(page)

        console.log('Done.')
    } finally {
        await browser.close()
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
