'use server'

import { createClient } from '@/lib/supabase/server'

export interface SeasonEarnings {
    totalEarnings: number
    totalMatches: number
    averagePerMatch: number
    averageRating: number
    monthlyBreakdown: { month: string; earnings: number; matches: number }[]
}

export async function getSeasonEarnings(): Promise<{ data?: SeasonEarnings; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Season runs Sep-Aug. Determine current season start.
    const now = new Date()
    const seasonStartYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
    const seasonStart = `${seasonStartYear}-09-01`
    const seasonEnd = `${seasonStartYear + 1}-08-31`

    // Get all confirmed/completed booking offers for this referee in the season
    const { data: offers, error } = await supabase
        .from('booking_offers')
        .select(`
            price_pence,
            booking:bookings!inner(
                match_date,
                status
            )
        `)
        .eq('referee_id', user.id)
        .in('status', ['accepted', 'accepted_priced'])

    if (error) return { error: error.message }

    // Filter to this season and completed/confirmed
    const seasonOffers = (offers || []).filter(o => {
        const booking = Array.isArray(o.booking) ? o.booking[0] : o.booking
        if (!booking) return false
        return booking.match_date >= seasonStart &&
            booking.match_date <= seasonEnd &&
            ['confirmed', 'completed'].includes(booking.status)
    })

    // Calculate totals
    const totalEarnings = seasonOffers.reduce((sum, o) => sum + (o.price_pence || 0), 0) / 100
    const totalMatches = seasonOffers.length
    const averagePerMatch = totalMatches > 0 ? totalEarnings / totalMatches : 0

    // Get average rating
    const { data: ratings } = await supabase
        .from('match_ratings')
        .select('rating')
        .eq('referee_id', user.id)

    const averageRating = ratings && ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0

    // Monthly breakdown
    const monthMap = new Map<string, { earnings: number; matches: number }>()

    // Initialize all months in the season
    for (let m = 0; m < 12; m++) {
        const monthDate = new Date(seasonStartYear, 8 + m, 1) // Start from September
        const key = monthDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
        monthMap.set(key, { earnings: 0, matches: 0 })
    }

    seasonOffers.forEach(o => {
        const booking = Array.isArray(o.booking) ? o.booking[0] : o.booking
        if (!booking) return
        const d = new Date(booking.match_date + 'T00:00:00')
        const key = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
        const entry = monthMap.get(key)
        if (entry) {
            entry.earnings += (o.price_pence || 0) / 100
            entry.matches += 1
        }
    })

    const monthlyBreakdown = Array.from(monthMap.entries()).map(([month, data]) => ({
        month,
        earnings: Math.round(data.earnings * 100) / 100,
        matches: data.matches,
    }))

    return {
        data: {
            totalEarnings: Math.round(totalEarnings * 100) / 100,
            totalMatches,
            averagePerMatch: Math.round(averagePerMatch * 100) / 100,
            averageRating: Math.round(averageRating * 10) / 10,
            monthlyBreakdown,
        },
    }
}
