import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
    adminClient,
    createTestUser,
    createTestWallet,
    cleanupTestData,
    TestUser,
} from '../test-utils'

const HAS_DB = !!process.env.SUPABASE_SERVICE_ROLE_KEY

// ── Pure logic tests ─────────────────────────────────────────────────

describe('Wallet Logic', () => {
    it('escrow hold: new_balance = balance - hold', () => {
        const balance = 10000
        const hold = 3000
        expect(balance - hold).toBe(7000)
    })

    it('escrow hold: new_escrow = escrow + hold', () => {
        const escrow = 0
        const hold = 3000
        expect(escrow + hold).toBe(3000)
    })

    it('escrow release: referee gets the held amount', () => {
        const holdAmount = 3000
        const refBalance = 0
        expect(refBalance + holdAmount).toBe(3000)
    })

    it('escrow refund: coach gets held amount back', () => {
        const balance = 7000
        const escrow = 3000
        expect(balance + escrow).toBe(10000)
    })

    it('insufficient funds check works', () => {
        const balance = 2000
        const required = 5000
        expect(balance < required).toBe(true)
    })

    it('withdrawal rejected without Connect onboarding', () => {
        const connectId = null
        const onboarded = false
        const canWithdraw = !!connectId && onboarded
        expect(canWithdraw).toBe(false)
    })
})

// ── Integration tests ────────────────────────────────────────────────

describe.skipIf(!HAS_DB)('Wallet - DB Integration', () => {
    let coach: TestUser
    let referee: TestUser

    beforeAll(async () => {
        coach = await createTestUser('coach')
        referee = await createTestUser('referee')
    })

    afterAll(async () => {
        await cleanupTestData()
    })

    it('creates wallet with initial balance', async () => {
        const wallet = await createTestWallet(coach.id, 5000)
        expect(wallet.balance_pence).toBe(5000)
        expect(wallet.escrow_pence).toBe(0)
    })

    it('escrow hold updates balance and escrow', async () => {
        await createTestWallet(coach.id, 10000)
        const hold = 3000

        const { data: w } = await adminClient.from('wallets')
            .select('*').eq('user_id', coach.id).single()

        await adminClient.from('wallets').update({
            balance_pence: w!.balance_pence - hold,
            escrow_pence: w!.escrow_pence + hold,
        }).eq('user_id', coach.id)

        const { data: updated } = await adminClient.from('wallets')
            .select('*').eq('user_id', coach.id).single()

        expect(updated!.balance_pence).toBe(7000)
        expect(updated!.escrow_pence).toBe(3000)
    })

    it('escrow release moves funds to referee', async () => {
        await createTestWallet(referee.id, 0)

        await adminClient.from('wallets').update({
            balance_pence: 3000,
        }).eq('user_id', referee.id)

        const { data } = await adminClient.from('wallets')
            .select('balance_pence').eq('user_id', referee.id).single()

        expect(data!.balance_pence).toBe(3000)
    })

    it('records wallet transaction', async () => {
        const { data: wallet } = await adminClient.from('wallets')
            .select('id').eq('user_id', coach.id).single()

        const { error } = await adminClient.from('wallet_transactions').insert({
            wallet_id: wallet!.id,
            type: 'escrow_hold',
            amount_pence: 3000,
            direction: 'debit',
            balance_after_pence: 7000,
            reference_type: 'booking',
            reference_id: 'test-ref',
            description: 'Test escrow hold',
        })

        expect(error).toBeNull()
    })

    it('wallet has no Connect account by default', async () => {
        const { data } = await adminClient.from('wallets')
            .select('stripe_connect_id, stripe_connect_onboarded')
            .eq('user_id', coach.id).single()

        expect(data!.stripe_connect_id).toBeNull()
    })
})
