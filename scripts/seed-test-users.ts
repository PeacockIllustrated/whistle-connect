/**
 * Idempotent test-user seed for Whistle Connect e2e + manual testing.
 *
 * Creates a known coach + referee pair with deterministic emails so
 * Playwright specs (and manual smoke-testing) can log in without first
 * registering. Safe to re-run — existing rows are upserted, not duplicated.
 *
 * USAGE
 *   npm run seed:test          # create / refresh users
 *   npm run seed:test -- --clean   # remove the test users + their data
 *
 * ENV
 *   NEXT_PUBLIC_SUPABASE_URL        — the target Supabase project
 *   SUPABASE_SERVICE_ROLE_KEY       — admin key (bypasses RLS)
 *
 * SAFETY
 *   Refuses to run against the production whistle-connect project. Use a
 *   Supabase preview branch (mcp create_branch) or a separate test project.
 *   To override (e.g. you've stood up a fresh test project that happens to
 *   share the ref), set SEED_ALLOW_PROD=1 — but you almost certainly don't
 *   want that.
 */

import 'dotenv/config'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load .env.local in addition to .env (mirrors __tests__/setup.ts)
config({ path: '.env.local' })

const PROD_PROJECT_REF = 'tszyfzctjxlopvsvbinj'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
}

if (SUPABASE_URL.includes(PROD_PROJECT_REF) && process.env.SEED_ALLOW_PROD !== '1') {
    console.error(
        `Refusing to seed against production project (${PROD_PROJECT_REF}).\n` +
        'Use a Supabase preview branch or a separate test project. To override\n' +
        'set SEED_ALLOW_PROD=1 (almost certainly a mistake).',
    )
    process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
})

// Deterministic identities so e2e specs can hard-code emails + passwords.
export const TEST_COACH = {
    email: process.env.TEST_COACH_EMAIL || 'test-coach@whistle-test.local',
    password: process.env.TEST_COACH_PASSWORD || 'TestPassword123!',
    fullName: 'Test Coach',
}
export const TEST_REFEREE = {
    email: process.env.TEST_REFEREE_EMAIL || 'test-referee@whistle-test.local',
    password: process.env.TEST_REFEREE_PASSWORD || 'TestPassword123!',
    fullName: 'Test Referee',
}

/** Find an auth user by email — paginated, since admin.listUsers caps at 1000 per page. */
async function findUserByEmail(email: string): Promise<string | null> {
    // Whistle Connect prod is hundreds of users, not millions — a single
    // 1000-row page is sufficient for the seed's purposes.
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const u = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    return u?.id ?? null
}

async function upsertUser(
    role: 'coach' | 'referee',
    identity: typeof TEST_COACH,
): Promise<string> {
    let userId = await findUserByEmail(identity.email)

    if (!userId) {
        const { data, error } = await admin.auth.admin.createUser({
            email: identity.email,
            password: identity.password,
            email_confirm: true,
        })
        if (error) throw new Error(`createUser ${identity.email}: ${error.message}`)
        userId = data.user.id
        console.log(`  created auth user ${identity.email}`)
    } else {
        // Refresh password in case it was rotated since last seed
        await admin.auth.admin.updateUserById(userId, { password: identity.password })
        console.log(`  reused auth user ${identity.email}`)
    }

    // profiles row
    const { error: profileErr } = await admin.from('profiles').upsert(
        { id: userId, full_name: identity.fullName, role },
        { onConflict: 'id' },
    )
    if (profileErr) throw new Error(`profile upsert: ${profileErr.message}`)

    return userId
}

async function upsertRefereeProfile(refereeId: string) {
    // Yorkshire / Leeds coordinates — keeps the test ref geographically
    // inside the seed booking's search radius. central_venue_opt_in +
    // tournament_opt_in start FALSE so the opt-in spec can toggle them on.
    const { error } = await admin.from('referee_profiles').upsert(
        {
            profile_id: refereeId,
            county: 'Yorkshire',
            level: '7',
            verified: true,
            is_available: true,
            fa_verification_status: 'verified',
            dbs_status: 'verified',
            travel_radius_km: 30,
            central_venue_opt_in: false,
            tournament_opt_in: false,
            latitude: 53.7997,
            longitude: -1.5492,
        },
        { onConflict: 'profile_id' },
    )
    if (error) throw new Error(`referee_profile upsert: ${error.message}`)
}

async function upsertCoachWallet(coachId: string) {
    // £200 starting balance so the coach can hold escrow on the test
    // bookings without needing a Stripe top-up round-trip.
    const { error } = await admin.from('wallets').upsert(
        { user_id: coachId, balance_pence: 20000, escrow_pence: 0 },
        { onConflict: 'user_id' },
    )
    if (error) throw new Error(`wallet upsert: ${error.message}`)
}

async function clean(): Promise<void> {
    console.log('Cleaning test users + cascaded data...')
    for (const identity of [TEST_COACH, TEST_REFEREE]) {
        const id = await findUserByEmail(identity.email)
        if (!id) {
            console.log(`  ${identity.email}: not present, skipping`)
            continue
        }
        // Owned booking rows first — bookings.coach_id is the FK that holds
        // up profile deletion if any seed-bookings still exist. Deletes here
        // cascade through booking_offers / booking_assignments via the
        // existing FK ON DELETE CASCADE chain.
        await admin.from('bookings').delete().eq('coach_id', id)
        // Wallet + referee_profile may not have ON DELETE CASCADE — clear
        // them explicitly so auth.admin.deleteUser doesn't trip on the FK.
        await admin.from('wallets').delete().eq('user_id', id)
        await admin.from('referee_profiles').delete().eq('profile_id', id)
        await admin.from('profiles').delete().eq('id', id)
        const { error } = await admin.auth.admin.deleteUser(id)
        if (error) console.warn(`  deleteUser ${identity.email}: ${error.message}`)
        console.log(`  removed ${identity.email}`)
    }
    console.log('Done.')
}

async function seed(): Promise<void> {
    console.log(`Seeding test users on ${SUPABASE_URL}`)

    console.log('Coach:')
    const coachId = await upsertUser('coach', TEST_COACH)
    await upsertCoachWallet(coachId)

    console.log('Referee:')
    const refId = await upsertUser('referee', TEST_REFEREE)
    await upsertRefereeProfile(refId)

    console.log('\nDone. Login credentials:')
    console.log(`  Coach    ${TEST_COACH.email} / ${TEST_COACH.password}`)
    console.log(`  Referee  ${TEST_REFEREE.email} / ${TEST_REFEREE.password}`)
    console.log(`\nIDs:`)
    console.log(`  coachId  ${coachId}`)
    console.log(`  refId    ${refId}`)
}

const args = new Set(process.argv.slice(2))
const task = args.has('--clean') ? clean() : seed()

task.catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
})
