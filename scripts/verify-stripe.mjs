// One-off verification script for the Stripe integration.
// Runs against whatever keys are in .env.local — MUST be test keys.
// Safe to re-run: creates test-mode customers/sessions/accounts only.
//
// Usage:  node --env-file=.env.local scripts/verify-stripe.mjs

import Stripe from 'stripe'
import { strict as assert } from 'node:assert'

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RESET = '\x1b[0m'
const pass = (msg) => console.log(`${GREEN}✓${RESET} ${msg}`)
const fail = (msg, err) => { console.log(`${RED}✗${RESET} ${msg}`); if (err) console.log(`  ${err.message || err}`); process.exitCode = 1 }
const info = (msg) => console.log(`${YELLOW}•${RESET} ${msg}`)

async function main() {
    // ---- 1. env vars present ----
    const key = process.env.STRIPE_SECRET_KEY
    const pub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    const whs = process.env.STRIPE_WEBHOOK_SECRET

    if (!key) return fail('STRIPE_SECRET_KEY missing')
    if (!pub) return fail('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing')
    if (!whs) return fail('STRIPE_WEBHOOK_SECRET missing')
    pass('env vars present')

    // Safety: refuse to run against live keys
    if (key.startsWith('sk_live_') || pub.startsWith('pk_live_')) {
        return fail('REFUSING TO RUN: live keys detected. This script is test-mode only.')
    }
    if (!key.startsWith('sk_test_')) return fail('STRIPE_SECRET_KEY is not a test key (sk_test_*)')
    if (!pub.startsWith('pk_test_')) return fail('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not a test key (pk_test_*)')
    if (!whs.startsWith('whsec_')) return fail('STRIPE_WEBHOOK_SECRET does not look like a webhook secret (whsec_*)')
    pass('keys are test-mode')

    // ---- 2. instantiate client using the exact same apiVersion as the app ----
    let stripe
    try {
        stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia', typescript: true })
        pass('Stripe SDK instantiated')
    } catch (err) {
        return fail('Stripe SDK instantiation', err)
    }

    // ---- 3. round-trip: list balance (cheapest auth check) ----
    try {
        const bal = await stripe.balance.retrieve()
        pass(`auth OK — balance available: ${bal.available.length} currencies`)
    } catch (err) {
        return fail('stripe.balance.retrieve (auth check)', err)
    }

    // ---- 4. customer create (same call path as createTopUpSession) ----
    let customer
    try {
        customer = await stripe.customers.create({
            email: 'verify+topup@whistle-connect.test',
            name: 'Verification User',
            metadata: { supabase_user_id: 'verify-script-dummy' },
        })
        pass(`stripe.customers.create OK (${customer.id})`)
    } catch (err) {
        return fail('stripe.customers.create', err)
    }

    // ---- 5. checkout session create (same call path as createTopUpSession) ----
    //    Exercises: fee math, GBP currency, metadata, success/cancel URLs
    try {
        // Mirror src/lib/stripe/config.ts exactly
        const STRIPE_PERCENTAGE = 0.025
        const STRIPE_FIXED_PENCE = 20
        const desiredPence = 2000 // £20 top-up
        const chargePence = Math.ceil((desiredPence + STRIPE_FIXED_PENCE) / (1 - STRIPE_PERCENTAGE))

        // Sanity-check the math
        assert.equal(chargePence, 2072, `expected £20 top-up to charge 2072p, got ${chargePence}p`)
        pass(`fee math OK — £20 net ⇒ ${chargePence}p gross (fee ${chargePence - desiredPence}p)`)

        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            mode: 'payment',
            currency: 'gbp',
            line_items: [{
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: 'Wallet Top-Up — £20.00',
                        description: 'Add £20.00 to your Whistle Connect wallet',
                    },
                    unit_amount: chargePence,
                },
                quantity: 1,
            }],
            metadata: {
                supabase_user_id: 'verify-script-dummy',
                desired_amount_pence: desiredPence.toString(),
                type: 'wallet_top_up',
            },
            success_url: 'http://localhost:3000/app/wallet?topup=success',
            cancel_url: 'http://localhost:3000/app/wallet?topup=cancelled',
        })
        assert.ok(session.url, 'checkout session returned no URL')
        assert.equal(session.currency, 'gbp')
        assert.equal(session.metadata.type, 'wallet_top_up')
        pass(`stripe.checkout.sessions.create OK (${session.id})`)
        info(`  → test checkout URL: ${session.url}`)
    } catch (err) {
        fail('stripe.checkout.sessions.create', err)
    }

    // ---- 6. Connect Express account create (same call path as createStripeConnectLink) ----
    let account
    try {
        account = await stripe.accounts.create({
            type: 'express',
            country: 'GB',
            email: 'verify+connect@whistle-connect.test',
            capabilities: { transfers: { requested: true } },
            metadata: { supabase_user_id: 'verify-script-dummy' },
        })
        pass(`stripe.accounts.create (Express/GB) OK (${account.id})`)
    } catch (err) {
        fail('stripe.accounts.create', err)
    }

    // ---- 7. Account link generation ----
    if (account) {
        try {
            const link = await stripe.accountLinks.create({
                account: account.id,
                refresh_url: 'http://localhost:3000/app/wallet/withdraw?connect=refresh',
                return_url: 'http://localhost:3000/app/wallet/withdraw?connect=complete',
                type: 'account_onboarding',
            })
            assert.ok(link.url)
            pass('stripe.accountLinks.create OK')
            info(`  → onboarding URL: ${link.url}`)
        } catch (err) {
            fail('stripe.accountLinks.create', err)
        }
    }

    // ---- 8. Webhook signature construction (mirrors what Stripe sends) ----
    try {
        const payload = JSON.stringify({
            id: 'evt_test_webhook',
            object: 'event',
            type: 'checkout.session.completed',
            data: { object: { id: 'cs_test_verify', metadata: {} } },
        })
        const timestamp = Math.floor(Date.now() / 1000)
        const header = stripe.webhooks.generateTestHeaderString({
            payload, timestamp, secret: whs,
        })
        const event = stripe.webhooks.constructEvent(payload, header, whs)
        assert.equal(event.type, 'checkout.session.completed')
        pass('webhook signature verify round-trip OK')
    } catch (err) {
        fail('webhook signature verify', err)
    }

    // ---- 9. Transfers capability probe ----
    //    Can't actually create a transfer (Connect account isn't onboarded) but we can
    //    verify the API surface rejects correctly and hasn't changed.
    try {
        await stripe.transfers.create({
            amount: 500,
            currency: 'gbp',
            destination: account?.id || 'acct_nonexistent',
            metadata: { verify: '1' },
        })
        // If this succeeds on a brand-new account, something's odd but not fatal.
        pass('stripe.transfers.create succeeded (unexpected on unverified account)')
    } catch (err) {
        // Expected: account not enabled for transfers yet. Any other error = red flag.
        const expected = /not enabled|does not have.*transfers|InvalidRequest|No such destination|transfers.*inactive/i
        if (expected.test(err.message)) {
            pass(`stripe.transfers.create rejects unverified account as expected`)
        } else {
            fail('stripe.transfers.create unexpected error', err)
        }
    }

    console.log()
    if (process.exitCode) {
        console.log(`${RED}FAILED${RESET} — see errors above`)
    } else {
        console.log(`${GREEN}ALL CHECKS PASSED${RESET}`)
    }
}

main().catch((err) => fail('unhandled', err))
