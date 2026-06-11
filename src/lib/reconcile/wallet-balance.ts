export interface ReconcilableWallet {
    id: string
    user_id: string
    balance_pence: number
    escrow_pence: number
}

// The wallet_transactions table is an activity log, not strict double-entry:
// escrow_hold writes a debit for an internal balance->escrow move (the money
// is still in the wallet, in escrow_pence), and escrow_release writes a
// notional coach-side debit plus a separate platform_fee debit. So
// Σ(credit) - Σ(debit) does NOT equal balance_pence + escrow_pence and
// never did. The trustworthy invariants are:
//   - balance_pence  == the running balance the ledger itself last recorded
//                        (most recent wallet_transactions.balance_after_pence,
//                        or 0 when the wallet has no transactions)
//   - escrow_pence    == Σ escrow_amount_pence over the user's bookings
//                        whose escrow is still held (amount set, not released)
export function describeWalletMismatch(
    wallet: ReconcilableWallet,
    expectedBalance: number,
    expectedEscrow: number
): string | null {
    const balanceOff = wallet.balance_pence !== expectedBalance
    const escrowOff = wallet.escrow_pence !== expectedEscrow
    if (!balanceOff && !escrowOff) return null

    const parts: string[] = []
    if (balanceOff) {
        parts.push(
            `balance ${wallet.balance_pence} != expected ${expectedBalance} (latest ledger balance_after)`
        )
    }
    if (escrowOff) {
        parts.push(
            `escrow ${wallet.escrow_pence} != expected ${expectedEscrow} (held bookings)`
        )
    }
    return `Wallet ${wallet.id} (user ${wallet.user_id}): ${parts.join('; ')}`
}
