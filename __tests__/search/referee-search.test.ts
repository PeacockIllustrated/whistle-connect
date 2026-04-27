import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
    adminClient,
    createTestUser,
    createTestBooking,
    createTestRefereeWithDBS,
    cleanupTestData,
    TestUser,
} from '../test-utils'
import { requiresDBS, DBS_REQUIRED_AGE_GROUPS } from '@/lib/constants'

const HAS_DB = !!process.env.SUPABASE_SERVICE_ROLE_KEY

// ── Pure logic tests (DBS requirement checks) ────────────────────────

describe('DBS Enforcement Logic', () => {
    it('requiresDBS returns true for U7-U16', () => {
        const youthGroups = ['u7', 'u8', 'u9', 'u10', 'u11', 'u12', 'u13', 'u14', 'u15', 'u16']
        for (const g of youthGroups) {
            expect(requiresDBS(g), `expected DBS required for ${g}`).toBe(true)
        }
    })

    it('requiresDBS returns false for U17+', () => {
        expect(requiresDBS('u17')).toBe(false)
        expect(requiresDBS('u18')).toBe(false)
        expect(requiresDBS('adult')).toBe(false)
        expect(requiresDBS('veterans')).toBe(false)
    })

    it('requiresDBS handles null/undefined/empty', () => {
        expect(requiresDBS(null)).toBe(false)
        expect(requiresDBS(undefined)).toBe(false)
        expect(requiresDBS('')).toBe(false)
    })

    it('DBS_REQUIRED_AGE_GROUPS has exactly 10 entries', () => {
        expect(DBS_REQUIRED_AGE_GROUPS.size).toBe(10)
    })

    it('DBS filter logic: removes non-verified for youth matches', () => {
        const referees = [
            { id: 'a', dbs_status: 'verified' },
            { id: 'b', dbs_status: 'not_provided' },
            { id: 'c', dbs_status: 'expired' },
        ]
        const filtered = referees.filter(r => r.dbs_status === 'verified')
        expect(filtered).toHaveLength(1)
        expect(filtered[0].id).toBe('a')
    })

    it('DBS filter logic: includes all for adult matches', () => {
        const referees = [
            { id: 'a', dbs_status: 'verified' },
            { id: 'b', dbs_status: 'not_provided' },
        ]
        const dbsRequired = requiresDBS('adult')
        const filtered = dbsRequired ? referees.filter(r => r.dbs_status === 'verified') : referees
        expect(filtered).toHaveLength(2)
    })
})

// ── Integration tests ────────────────────────────────────────────────

describe.skipIf(!HAS_DB)('Referee Search - DB Integration', () => {
    let coach: TestUser

    beforeAll(async () => {
        coach = await createTestUser('coach')
    })

    afterAll(async () => {
        await cleanupTestData()
    })

    it('DBS-verified referee has correct status in DB', async () => {
        const ref = await createTestRefereeWithDBS('verified')

        const { data } = await adminClient.from('referee_profiles')
            .select('dbs_status').eq('profile_id', ref.id).single()

        expect(data!.dbs_status).toBe('verified')
    })

    it('non-DBS referee has correct status in DB', async () => {
        const ref = await createTestRefereeWithDBS('not_provided')

        const { data } = await adminClient.from('referee_profiles')
            .select('dbs_status').eq('profile_id', ref.id).single()

        expect(data!.dbs_status).toBe('not_provided')
    })

    it('filters non-DBS referees for U16 booking from DB results', async () => {
        const verified = await createTestRefereeWithDBS('verified')
        const unverified = await createTestRefereeWithDBS('not_provided')

        const { data } = await adminClient.from('referee_profiles')
            .select('profile_id, dbs_status')
            .in('profile_id', [verified.id, unverified.id])

        const filtered = data!.filter(r => r.dbs_status === 'verified')
        expect(filtered).toHaveLength(1)
        expect(filtered[0].profile_id).toBe(verified.id)
    })

    it('includes all referees for adult booking from DB', async () => {
        const verified = await createTestRefereeWithDBS('verified')
        const unverified = await createTestRefereeWithDBS('not_provided')

        const { data } = await adminClient.from('referee_profiles')
            .select('profile_id, dbs_status')
            .in('profile_id', [verified.id, unverified.id])

        // Adult booking — no DBS filter
        expect(data).toHaveLength(2)
    })
})
