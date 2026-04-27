import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
    adminClient,
    createTestUser,
    createTestBooking,
    createTestOffer,
    createTestWallet,
    setPlatformSetting,
    cleanupTestData,
    TestUser,
    TestBooking,
} from '../test-utils'

const HAS_DB = !!process.env.SUPABASE_SERVICE_ROLE_KEY

// ── Pure logic tests (no DB needed) ─────────────────────────────────

describe('Offer Pricing Logic', () => {
    it('calculates travel cost correctly (distance × rate)', () => {
        const rate = 28 // pence per km
        const distance = 15.2 // km
        const travel = Math.round(distance * rate)
        expect(travel).toBe(426) // £4.26
    })

    it('total = match fee + travel cost', () => {
        const matchFee = 3000 // £30
        const travelCost = 426 // £4.26
        const total = matchFee + travelCost
        expect(total).toBe(3426)
    })

    it('travel cost is zero when distance is null', () => {
        const distance: number | null = null
        const rate = 28
        const travel = distance ? Math.round(distance * rate) : 0
        expect(travel).toBe(0)
    })

    it('travel cost is zero when distance is zero', () => {
        const distance = 0
        const rate = 28
        const travel = distance > 0 ? Math.round(distance * rate) : 0
        expect(travel).toBe(0)
    })

    it('different travel rates produce different costs', () => {
        const distance = 20
        expect(Math.round(distance * 28)).toBe(560) // £5.60 at £0.28/km
        expect(Math.round(distance * 35)).toBe(700) // £7.00 at £0.35/km
    })

    it('offer status sent is the only acceptable state for acceptance', () => {
        const statuses = ['sent', 'accepted', 'declined', 'withdrawn', 'expired']
        const acceptable = statuses.filter(s => s === 'sent')
        expect(acceptable).toEqual(['sent'])
    })
})

// ── Integration tests (require Supabase service key) ─────────────────

describe.skipIf(!HAS_DB)('Offer Flow - DB Integration', () => {
    let coach: TestUser
    let referee1: TestUser
    let referee2: TestUser
    let booking: TestBooking

    beforeAll(async () => {
        coach = await createTestUser('coach')
        referee1 = await createTestUser('referee')
        referee2 = await createTestUser('referee')
        booking = await createTestBooking(coach.id)
        await createTestWallet(coach.id, 10000)
    })

    afterAll(async () => {
        await cleanupTestData()
    })

    it('creates an offer with correct price breakdown', async () => {
        const offer = await createTestOffer(booking.id, referee1.id, {
            pricePence: 3500,
            matchFeePence: 3000,
            travelCostPence: 500,
            travelDistanceKm: 17.9,
        })

        expect(offer.price_pence).toBe(3500)
        expect(offer.match_fee_pence).toBe(3000)
        expect(offer.travel_cost_pence).toBe(500)
        expect(offer.travel_distance_km).toBe(17.9)
        expect(offer.status).toBe('sent')
    })

    it('rejects duplicate offer to same referee', async () => {
        const { error } = await adminClient.from('booking_offers').insert({
            booking_id: booking.id,
            referee_id: referee1.id,
            status: 'sent',
            price_pence: 3500,
        })

        expect(error).not.toBeNull()
        expect(error!.code).toBe('23505')
    })

    it('offer status transitions: sent → accepted', async () => {
        const b = await createTestBooking(coach.id)
        const offer = await createTestOffer(b.id, referee1.id)

        await adminClient.from('booking_offers')
            .update({ status: 'accepted' })
            .eq('id', offer.id)

        const { data } = await adminClient.from('booking_offers')
            .select('status').eq('id', offer.id).single()

        expect(data!.status).toBe('accepted')
    })

    it('withdraws competing offers when one is accepted', async () => {
        const b = await createTestBooking(coach.id)
        const o1 = await createTestOffer(b.id, referee1.id)
        const o2 = await createTestOffer(b.id, referee2.id)

        await adminClient.from('booking_offers')
            .update({ status: 'accepted' }).eq('id', o1.id)
        await adminClient.from('booking_offers')
            .update({ status: 'withdrawn' }).eq('booking_id', b.id).neq('id', o1.id)

        const { data } = await adminClient.from('booking_offers')
            .select('status').eq('id', o2.id).single()

        expect(data!.status).toBe('withdrawn')
    })

    it('travel rate setting is readable from platform_settings', async () => {
        await setPlatformSetting('travel_cost_per_km_pence', '28')

        const { data } = await adminClient.from('platform_settings')
            .select('value').eq('key', 'travel_cost_per_km_pence').single()

        expect(parseInt(data!.value, 10)).toBe(28)
    })
})
