const STRIPE_PERCENTAGE = 0.025
const STRIPE_FIXED_PENCE = 20

export const STRIPE_CONFIG = {
    MIN_TOP_UP_POUNDS: 5,
    MAX_TOP_UP_POUNDS: 500,
    MIN_WITHDRAWAL_POUNDS: 5,
    CURRENCY: 'gbp' as const,
}

export function calculateChargeAmount(desiredPence: number): {
    chargePence: number
    estimatedFeePence: number
} {
    const chargeRaw = (desiredPence + STRIPE_FIXED_PENCE) / (1 - STRIPE_PERCENTAGE)
    const chargePence = Math.ceil(chargeRaw)
    const estimatedFeePence = chargePence - desiredPence

    return { chargePence, estimatedFeePence }
}

export function calculateWalletCredit(chargePence: number, actualFeePence: number): number {
    return chargePence - actualFeePence
}
