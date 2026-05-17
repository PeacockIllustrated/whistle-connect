import { describe, it, expect } from 'vitest'
import { describeWalletMismatch } from '@/lib/reconcile/wallet-balance'

// Scenarios mirror real production wallets investigated 2026-05-17.

describe('describeWalletMismatch', () => {
    it('clean coach with escrow history is NOT flagged (the old false-positive)', () => {
        // tom@coach.com: top_up 500 -> hold 394 -> release. Stored balance 106
        // == latest ledger balance_after 106; no escrow held. The old
        // Σcredit−Σdebit check wrongly flagged this.
        expect(
            describeWalletMismatch(
                { id: 'w1', user_id: 'u1', balance_pence: 106, escrow_pence: 0 },
                106,
                0
            )
        ).toBeNull()
    })

    it('coach with an open hold reconciles against held bookings', () => {
        // davidshort: balance 309 == latest 309; escrow 297 == one held booking
        expect(
            describeWalletMismatch(
                { id: 'w2', user_id: 'u2', balance_pence: 309, escrow_pence: 297 },
                309,
                297
            )
        ).toBeNull()
    })

    it('flags a balance manually zeroed after a real credit', () => {
        // tom@referee.com: ledger recorded balance_after 295, stored balance 0
        const msg = describeWalletMismatch(
            { id: 'w3', user_id: 'u3', balance_pence: 0, escrow_pence: 0 },
            295,
            0
        )
        expect(msg).toContain('balance 0 != expected 295')
    })

    it('flags a seeded wallet with a balance but no ledger', () => {
        // @whistle-test.local: balance 10000, zero transactions => expected 0
        const msg = describeWalletMismatch(
            { id: 'w4', user_id: 'u4', balance_pence: 10000, escrow_pence: 0 },
            0,
            0
        )
        expect(msg).toContain('balance 10000 != expected 0')
    })

    it('flags an escrow mismatch independently of balance', () => {
        const msg = describeWalletMismatch(
            { id: 'w5', user_id: 'u5', balance_pence: 500, escrow_pence: 0 },
            500,
            297
        )
        expect(msg).toContain('escrow 0 != expected 297')
        expect(msg).not.toContain('!= expected 500')
    })

    it('reports both balance and escrow when both are off', () => {
        const msg = describeWalletMismatch(
            { id: 'w6', user_id: 'u6', balance_pence: 10, escrow_pence: 20 },
            0,
            0
        )
        expect(msg).toContain('balance 10 != expected 0')
        expect(msg).toContain('escrow 20 != expected 0')
    })

    it('empty wallet (no txns, zero balances) is NOT flagged', () => {
        expect(
            describeWalletMismatch(
                { id: 'w7', user_id: 'u7', balance_pence: 0, escrow_pence: 0 },
                0,
                0
            )
        ).toBeNull()
    })
})
