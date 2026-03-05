import { getMapboxAccessToken } from './env'

export interface GeocodingResult {
    lat: number
    lng: number
    placeName: string
}

/** Module-level cache: normalised postcode → result (persists for the session) */
const geocodeCache = new Map<string, GeocodingResult>()

/**
 * Forward-geocode a UK postcode to lat/lng via Mapbox Geocoding API.
 * Results are cached in-memory to avoid re-fetching the same postcode.
 */
export async function geocodePostcode(postcode: string): Promise<GeocodingResult | null> {
    const normalized = postcode.trim().toUpperCase()
    if (!normalized) return null

    const cached = geocodeCache.get(normalized)
    if (cached) return cached

    const token = getMapboxAccessToken()
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalized)}.json?access_token=${token}&country=gb&types=postcode&limit=1`

    try {
        const res = await fetch(url)
        if (!res.ok) return null

        const data = await res.json()
        if (!data.features || data.features.length === 0) return null

        const feature = data.features[0]
        const [lng, lat] = feature.center // Mapbox returns [lng, lat]
        const result: GeocodingResult = { lat, lng, placeName: feature.place_name || normalized }

        geocodeCache.set(normalized, result)
        return result
    } catch {
        return null
    }
}
