// One-shot pre-flight check for Stripe LIVE.
//
// Mirrors scripts/verify-stripe.mjs but specifically for production keys.
// Read-only — confirms the dashboard config is correct before any code
// goes live and any users hit a real payment surface.
//
// Usage:  node --env-file=.env.production.local scripts/verify-stripe-live.mjs
// (or pass STRIPE_SECRET_KEY etc. directly via the environment).
//
// Refuses to run against test keys — that's what the test-mode script is for.

import Stripe from 'stripe'

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RESET = '\x1b[0m'
const pass = (msg) => console.log(`${GREEN}✓${RESET} ${msg}`)
const fail = (msg, err) => { console.log(`${RED}✗${RESET} ${msg}`); if (err) console.log(`  ${err.message || err}`); process.exitCode = 1 }
const info = (msg) => console.log(`${YELLOW}•${RESET} ${msg}`)

async function main() {
    // ---- 1. env vars present ----
    const key = process.env.STRIPE_SECRET_KEY
    const whs = process.env.STRIPE_WEBHOOK_SECRET
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

    if (!key) return fail('STRIPE_SECRET_KEY missing')
    if (!whs) return fail('STRIPE_WEBHOOK_SECRET missing')
    if (!siteUrl) return fail('NEXT_PUBLIC_SITE_URL missing — needed to verify the registered webhook URL points at production')
    pass('env vars present')

    // Safety: refuse to run against test keys
    if (key.startsWith('sk_test_')) {
        return fail('REFUSING TO RUN: test key detected. This script is live-mode only — use scripts/verify-stripe.mjs for test keys.')
    }
    if (!key.startsWith('sk_live_')) return fail('STRIPE_SECRET_KEY is not a live key (sk_live_*)')
    if (!whs.startsWith('whsec_')) return fail('STRIPE_WEBHOOK_SECRET does not look like a webhook secret (whsec_*)')
    pass('keys are live-mode')

    // ---- 2. instantiate client using the exact same apiVersion as the app ----
    let stripe
    try {
        stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia', typescript: true })
        pass('Stripe SDK instantiated')
    } catch (err) {
        return fail('Stripe SDK instantiation', err)
    }

    // ---- 3. account retrieve (auth + capability summary) ----
    let account
    try {
        account = await stripe.accounts.retrieve()
        pass(`auth OK — account ${account.id} (${account.country || '?'} / ${account.default_currency?.toUpperCase() || '?'})`)
    } catch (err) {
        return fail('stripe.accounts.retrieve (auth check)', err)
    }

    // ---- 4. balance — confirms charges can actually settle ----
    try {
        const bal = await stripe.balance.retrieve()
        pass(`balance retrieved — ${bal.available.length} currencies in 'available'`)
    } catch (err) {
        fail('stripe.balance.retrieve', err)
    }

    // ---- 5. Connect platform active? ----
    // Hits the "list Connect accounts" endpoint; returns 200 with empty list
    // if Connect is enabled but no Connect accounts yet, 4xx if Connect not
    // activated on the platform.
    try {
        const accounts = await stripe.accounts.list({ limit: 1 })
        pass(`Connect platform active — ${accounts.data.length} existing Connect account(s) listed`)
    } catch (err) {
        fail('stripe.accounts.list — Connect platform may not be activated. Check Settings → Connect → Get started in the Stripe dashboard.', err)
    }

    // ---- 6. webhook endpoint registered to production URL? ----
    try {
        const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
        const expectedUrl = `${siteUrl.replace(/\/$/, '')}/api/webhooks/stripe`
        const matching = endpoints.data.find(e => e.url === expectedUrl)

        if (!matching) {
            fail(`No webhook endpoint registered for ${expectedUrl}. Register it in Stripe Dashboard → Developers → Webhooks.`)
            info(`Currently registered endpoints: ${endpoints.data.map(e => e.url).join(', ') || '(none)'}`)
        } else {
            pass(`webhook endpoint registered: ${matching.url} (${matching.status})`)
            const required = [
                'checkout.session.completed',
                'account.updated',
                'transfer.reversed',
            ]
            const missingEvents = required.filter(e => !matching.enabled_events.includes(e) && !matching.enabled_events.includes('*'))
            if (missingEvents.length > 0) {
                fail(`webhook endpoint missing required events: ${missingEvents.join(', ')}`)
            } else {
                pass('webhook endpoint subscribed to required events (checkout.session.completed, account.updated, transfer.reversed)')
            }
            const recommended = ['transfer.failed', 'charge.refunded', 'charge.dispute.created', 'payout.paid', 'payout.failed']
            const missingRecommended = recommended.filter(e => !matching.enabled_events.includes(e) && !matching.enabled_events.includes('*'))
            if (missingRecommended.length > 0) {
                info(`webhook endpoint missing recommended (Phase 2) events: ${missingRecommended.join(', ')}`)
            }
        }
    } catch (err) {
        fail('stripe.webhookEndpoints.list', err)
    }

    // ---- 7. application_fees endpoint reachable (sanity check on Connect platform) ----
    try {
        await stripe.applicationFees.list({ limit: 1 })
        pass('application_fees endpoint reachable (Connect API access confirmed)')
    } catch (err) {
        // Non-fatal — we don't currently use application fees, just verifying API access.
        info(`application_fees not reachable: ${err.message} (non-fatal — only relevant if you start using Connect direct charges)`)
    }

    // ---- 8. site URL sanity ----
    if (!siteUrl.startsWith('https://')) {
        fail(`NEXT_PUBLIC_SITE_URL must be https in production, got ${siteUrl}`)
    } else {
        pass(`NEXT_PUBLIC_SITE_URL is https: ${siteUrl}`)
    }

    // ---- summary ----
    if (process.exitCode === 1) {
        console.log(`\n${RED}One or more checks failed — fix before going live.${RESET}`)
    } else {
        console.log(`\n${GREEN}All pre-flight checks passed.${RESET} Stripe live config looks correct.`)
    }
}

main().catch((err) => {
    fail('script crashed', err)
    process.exit(1)
})
