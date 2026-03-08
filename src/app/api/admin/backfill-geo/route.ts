import { createClient } from '@/lib/supabase/server'
import { geocodePostcode } from '@/lib/mapbox/geocode'
import { NextResponse } from 'next/server'

export async function POST() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    let profilesUpdated = 0
    let bookingsUpdated = 0
    const errors: string[] = []

    // Backfill profiles
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, postcode')
        .not('postcode', 'is', null)
        .is('latitude', null)
        .limit(200)

    if (profiles) {
        for (const p of profiles) {
            if (!p.postcode) continue
            const geo = await geocodePostcode(p.postcode)
            if (geo) {
                const { error } = await supabase
                    .from('profiles')
                    .update({ latitude: geo.lat, longitude: geo.lng })
                    .eq('id', p.id)
                if (!error) profilesUpdated++
                else errors.push(`Profile ${p.id}: ${error.message}`)
            } else {
                errors.push(`Profile ${p.id}: geocoding failed for "${p.postcode}"`)
            }
        }
    }

    // Backfill bookings
    const { data: bookings } = await supabase
        .from('bookings')
        .select('id, location_postcode')
        .not('location_postcode', 'is', null)
        .is('latitude', null)
        .limit(200)

    if (bookings) {
        for (const b of bookings) {
            if (!b.location_postcode) continue
            const geo = await geocodePostcode(b.location_postcode)
            if (geo) {
                const { error } = await supabase
                    .from('bookings')
                    .update({ latitude: geo.lat, longitude: geo.lng })
                    .eq('id', b.id)
                if (!error) bookingsUpdated++
                else errors.push(`Booking ${b.id}: ${error.message}`)
            } else {
                errors.push(`Booking ${b.id}: geocoding failed for "${b.location_postcode}"`)
            }
        }
    }

    return NextResponse.json({
        success: true,
        profilesUpdated,
        bookingsUpdated,
        errors: errors.length > 0 ? errors : undefined,
    })
}
