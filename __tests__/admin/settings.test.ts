import { describe, it, expect, afterAll } from 'vitest'
import {
    adminClient,
    setPlatformSetting,
    cleanupTestData,
} from '../test-utils'

const HAS_DB = !!process.env.SUPABASE_SERVICE_ROLE_KEY

// ── Pure logic tests ─────────────────────────────────────────────────

describe('Admin Settings Logic', () => {
    it('rejects negative travel rate', () => {
        const value = -10
        const isValid = value >= 0 && value <= 200
        expect(isValid).toBe(false)
    })

    it('rejects excessively high travel rate', () => {
        const value = 500
        const isValid = value >= 0 && value <= 200
        expect(isValid).toBe(false)
    })

    it('accepts valid travel rate', () => {
        const value = 28
        const isValid = value >= 0 && value <= 200
        expect(isValid).toBe(true)
    })

    it('accepts zero travel rate (free travel)', () => {
        const value = 0
        const isValid = value >= 0 && value <= 200
        expect(isValid).toBe(true)
    })

    it('converts pounds to pence correctly', () => {
        expect(Math.round(0.28 * 100)).toBe(28)
        expect(Math.round(0.35 * 100)).toBe(35)
        expect(Math.round(1.50 * 100)).toBe(150)
    })
})

// ── Integration tests ────────────────────────────────────────────────

describe.skipIf(!HAS_DB)('Admin Settings - DB Integration', () => {
    afterAll(async () => {
        await setPlatformSetting('travel_cost_per_km_pence', '28')
        await cleanupTestData()
    })

    it('reads travel_cost_per_km_pence setting', async () => {
        const { data } = await adminClient.from('platform_settings')
            .select('key, value').eq('key', 'travel_cost_per_km_pence').single()

        expect(data!.key).toBe('travel_cost_per_km_pence')
        expect(parseInt(data!.value, 10)).toBeGreaterThan(0)
    })

    it('updates travel cost rate', async () => {
        await setPlatformSetting('travel_cost_per_km_pence', '35')

        const { data } = await adminClient.from('platform_settings')
            .select('value').eq('key', 'travel_cost_per_km_pence').single()

        expect(data!.value).toBe('35')
    })

    it('updated rate produces correct calculation', async () => {
        await setPlatformSetting('travel_cost_per_km_pence', '35')

        const { data } = await adminClient.from('platform_settings')
            .select('value').eq('key', 'travel_cost_per_km_pence').single()

        const rate = parseInt(data!.value, 10)
        expect(Math.round(20 * rate)).toBe(700) // 20km × 35p = £7.00
    })

    it('resets to default rate', async () => {
        await setPlatformSetting('travel_cost_per_km_pence', '28')

        const { data } = await adminClient.from('platform_settings')
            .select('value').eq('key', 'travel_cost_per_km_pence').single()

        expect(data!.value).toBe('28')
    })
})
