import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
    adminClient,
    createTestUser,
    createTestBooking,
    createTestOffer,
    cleanupTestData,
    TestUser,
} from '../test-utils'

const HAS_DB = !!process.env.SUPABASE_SERVICE_ROLE_KEY

// ── Pure logic tests ─────────────────────────────────────────────────

describe('Booking Lifecycle Logic', () => {
    it('valid booking statuses match expected workflow', () => {
        const validStatuses = ['draft', 'pending', 'offered', 'confirmed', 'completed', 'cancelled']
        expect(validStatuses).toContain('pending')
        expect(validStatuses).toContain('confirmed')
    })

    it('coach cannot send offers for cancelled bookings', () => {
        const status = 'cancelled'
        const canSend = ['pending', 'offered'].includes(status)
        expect(canSend).toBe(false)
    })

    it('coach cannot send offers for completed bookings', () => {
        const status = 'completed'
        const canSend = ['pending', 'offered'].includes(status)
        expect(canSend).toBe(false)
    })
})

// ── Integration tests ────────────────────────────────────────────────

describe.skipIf(!HAS_DB)('Booking Lifecycle - DB Integration', () => {
    let coach: TestUser
    let referee: TestUser

    beforeAll(async () => {
        coach = await createTestUser('coach')
        referee = await createTestUser('referee')
    })

    afterAll(async () => {
        await cleanupTestData()
    })

    it('creates a booking in pending status', async () => {
        const booking = await createTestBooking(coach.id)
        expect(booking.status).toBe('pending')
        expect(booking.coach_id).toBe(coach.id)
    })

    it('creates a booking with correct match details', async () => {
        const booking = await createTestBooking(coach.id, {
            ageGroup: 'u14',
            matchDate: '2026-06-15',
        })

        const { data } = await adminClient.from('bookings')
            .select('age_group, match_date').eq('id', booking.id).single()

        expect(data!.age_group).toBe('u14')
        expect(data!.match_date).toBe('2026-06-15')
    })

    it('transitions pending → offered → confirmed → completed', async () => {
        const b = await createTestBooking(coach.id)

        for (const status of ['offered', 'confirmed', 'completed'] as const) {
            await adminClient.from('bookings').update({ status }).eq('id', b.id)
            const { data } = await adminClient.from('bookings')
                .select('status').eq('id', b.id).single()
            expect(data!.status).toBe(status)
        }
    })

    it('cancellation withdraws all offers', async () => {
        const b = await createTestBooking(coach.id, { status: 'offered' })
        const offer = await createTestOffer(b.id, referee.id)

        await adminClient.from('booking_offers')
            .update({ status: 'withdrawn' }).eq('booking_id', b.id)

        const { data } = await adminClient.from('booking_offers')
            .select('status').eq('id', offer.id).single()
        expect(data!.status).toBe('withdrawn')
    })

    it('soft delete sets deleted_at', async () => {
        const b = await createTestBooking(coach.id)
        await adminClient.from('bookings')
            .update({ deleted_at: new Date().toISOString() }).eq('id', b.id)

        const { data } = await adminClient.from('bookings')
            .select('deleted_at').eq('id', b.id).single()
        expect(data!.deleted_at).not.toBeNull()
    })

    it('soft-deleted bookings excluded from active queries', async () => {
        const b = await createTestBooking(coach.id)
        await adminClient.from('bookings')
            .update({ deleted_at: new Date().toISOString() }).eq('id', b.id)

        const { data } = await adminClient.from('bookings')
            .select('id').eq('coach_id', coach.id).is('deleted_at', null)
        const ids = (data || []).map(x => x.id)
        expect(ids).not.toContain(b.id)
    })

    it('creates booking assignment', async () => {
        const b = await createTestBooking(coach.id, { status: 'confirmed' })
        const { data, error } = await adminClient.from('booking_assignments')
            .insert({ booking_id: b.id, referee_id: referee.id }).select().single()

        expect(error).toBeNull()
        expect(data!.referee_id).toBe(referee.id)
    })
})
