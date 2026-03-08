'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { getMapReferees, MapReferee } from './actions'
import { getMyPostcode, saveMyGeolocation } from '@/app/app/profile/actions'
import { geocodePostcode } from '@/lib/mapbox/geocode'
import { loadMapboxGL } from '@/lib/mapbox/loader'
import { getMapboxAccessToken, getMapboxStyle } from '@/lib/mapbox/env'
import { escapeHtml } from '@/lib/utils'
import { ChevronLeft, MapPin, Loader2 } from 'lucide-react'

export default function MapPage() {
    const mapContainer = useRef<HTMLDivElement>(null)
    const mapRef = useRef<unknown>(null)
    const [referees, setReferees] = useState<MapReferee[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedRef, setSelectedRef] = useState<MapReferee | null>(null)
    const centerRef = useRef<{ lat: number; lng: number } | null>(null)

    const initMap = useCallback(async (center: { lat: number; lng: number }, refs: MapReferee[]) => {
        if (!mapContainer.current) return

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapboxgl = await loadMapboxGL() as any
            mapboxgl.accessToken = getMapboxAccessToken()

            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            const map = new mapboxgl.Map({
                container: mapContainer.current,
                style: getMapboxStyle(isDark ? 'dark' : 'light'),
                center: [center.lng, center.lat],
                zoom: 11,
            })

            mapRef.current = map

            map.addControl(new mapboxgl.NavigationControl(), 'top-right')

            map.on('load', () => {
                // Distance rings at 5, 10, 15 km
                const rings = [5, 10, 15]
                rings.forEach((km, i) => {
                    const points = 64
                    const coords = []
                    for (let j = 0; j <= points; j++) {
                        const angle = (j / points) * 360
                        const rad = (angle * Math.PI) / 180
                        const latOff = (km / 111.32) * Math.cos(rad)
                        const lngOff = (km / (111.32 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(rad)
                        coords.push([center.lng + lngOff, center.lat + latOff])
                    }

                    map.addSource(`ring-${km}`, {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: { type: 'Polygon', coordinates: [coords] },
                            properties: {},
                        },
                    })

                    map.addLayer({
                        id: `ring-fill-${km}`,
                        type: 'fill',
                        source: `ring-${km}`,
                        paint: {
                            'fill-color': '#3b82f6',
                            'fill-opacity': 0.03 + (0.02 * (rings.length - i)),
                        },
                    })

                    map.addLayer({
                        id: `ring-line-${km}`,
                        type: 'line',
                        source: `ring-${km}`,
                        paint: {
                            'line-color': '#3b82f6',
                            'line-width': 1,
                            'line-opacity': 0.3,
                            'line-dasharray': [4, 4],
                        },
                    })
                })

                // Coach marker (center)
                new mapboxgl.Marker({ color: '#1d4ed8' })
                    .setLngLat([center.lng, center.lat])
                    .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML('<strong>Your Location</strong>'))
                    .addTo(map)

                // Referee markers as GeoJSON source for clustering
                const geojson = {
                    type: 'FeatureCollection' as const,
                    features: refs.map(r => ({
                        type: 'Feature' as const,
                        geometry: {
                            type: 'Point' as const,
                            coordinates: [r.longitude, r.latitude],
                        },
                        properties: {
                            id: r.id,
                            name: r.full_name,
                            level: r.level || 'N/A',
                            is_available: r.is_available,
                            distance_km: r.distance_km,
                            reliability_score: r.reliability_score,
                            average_rating: r.average_rating,
                            total_matches: r.total_matches_completed,
                        },
                    })),
                }

                map.addSource('referees', {
                    type: 'geojson',
                    data: geojson,
                    cluster: true,
                    clusterMaxZoom: 14,
                    clusterRadius: 50,
                })

                // Cluster circles
                map.addLayer({
                    id: 'clusters',
                    type: 'circle',
                    source: 'referees',
                    filter: ['has', 'point_count'],
                    paint: {
                        'circle-color': [
                            'step', ['get', 'point_count'],
                            '#10b981', 5,
                            '#3b82f6', 10,
                            '#8b5cf6',
                        ],
                        'circle-radius': [
                            'step', ['get', 'point_count'],
                            18, 5, 24, 10, 30,
                        ],
                        'circle-opacity': 0.85,
                    },
                })

                // Cluster count labels
                map.addLayer({
                    id: 'cluster-count',
                    type: 'symbol',
                    source: 'referees',
                    filter: ['has', 'point_count'],
                    layout: {
                        'text-field': '{point_count_abbreviated}',
                        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
                        'text-size': 13,
                    },
                    paint: { 'text-color': '#ffffff' },
                })

                // Individual referee markers — pulsing glow effect
                map.addLayer({
                    id: 'referee-glow',
                    type: 'circle',
                    source: 'referees',
                    filter: ['!', ['has', 'point_count']],
                    paint: {
                        'circle-radius': 16,
                        'circle-color': [
                            'case',
                            ['get', 'is_available'], '#10b981',
                            '#94a3b8',
                        ],
                        'circle-opacity': 0.25,
                        'circle-blur': 0.8,
                    },
                })

                map.addLayer({
                    id: 'referee-dots',
                    type: 'circle',
                    source: 'referees',
                    filter: ['!', ['has', 'point_count']],
                    paint: {
                        'circle-radius': 7,
                        'circle-color': [
                            'case',
                            ['get', 'is_available'], '#10b981',
                            '#94a3b8',
                        ],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff',
                    },
                })

                // Click on cluster to zoom in
                map.on('click', 'clusters', (e: { features?: { geometry: { coordinates: number[] }; properties: { cluster_id: number } }[]; lngLat: { lng: number } }) => {
                    const features = e.features
                    if (!features?.length) return
                    const clusterId = features[0].properties.cluster_id
                    const source = map.getSource('referees')
                    source.getClusterExpansionZoom(clusterId, (err: Error, zoom: number) => {
                        if (err) return
                        map.easeTo({
                            center: features[0].geometry.coordinates,
                            zoom,
                        })
                    })
                })

                // Click on individual referee
                map.on('click', 'referee-dots', (e: { features?: { properties: { id: string; name: string; level: string; distance_km: number; reliability_score: number; average_rating: number; total_matches: number; is_available: boolean } }[]; lngLat: { lng: number; lat: number } }) => {
                    const features = e.features
                    if (!features?.length) return
                    const props = features[0].properties
                    const ref = refs.find(r => r.id === props.id)
                    if (ref) setSelectedRef(ref)

                    new mapboxgl.Popup({ offset: 25, closeButton: true })
                        .setLngLat([e.lngLat.lng, e.lngLat.lat])
                        .setHTML(`
                            <div style="font-family:system-ui;min-width:160px">
                                <strong>${escapeHtml(props.name)}</strong>
                                <div style="font-size:12px;color:#666;margin-top:4px">
                                    ${props.is_available ? '🟢 Available' : '⚪ Unavailable'}
                                </div>
                                <div style="font-size:11px;color:#888;margin-top:2px">
                                    Level ${escapeHtml(props.level)} · ${escapeHtml(props.distance_km)} km · ${Math.round(props.reliability_score)}% reliable
                                </div>
                                ${props.average_rating > 0 ? `<div style="font-size:11px;color:#888">⭐ ${props.average_rating.toFixed(1)} · ${escapeHtml(props.total_matches)} matches</div>` : ''}
                            </div>
                        `)
                        .addTo(map)
                })

                // Cursors
                map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer' })
                map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = '' })
                map.on('mouseenter', 'referee-dots', () => { map.getCanvas().style.cursor = 'pointer' })
                map.on('mouseleave', 'referee-dots', () => { map.getCanvas().style.cursor = '' })
            })
        } catch (err) {
            console.error('Map init error:', err)
            setError('Failed to load map')
        }
    }, [])

    useEffect(() => {
        async function load() {
            let result = await getMapReferees(30)

            // Auto-backfill: if lat/lon missing, geocode client-side and retry
            if (result.error?.includes('postcode')) {
                const info = await getMyPostcode()
                if (info.postcode) {
                    const geo = await geocodePostcode(info.postcode)
                    if (geo) {
                        await saveMyGeolocation(geo.lat, geo.lng)
                        result = await getMapReferees(30)
                    }
                }
            }

            if (result.error) {
                setError(result.error)
            } else {
                setReferees(result.data || [])
                if (result.center) {
                    centerRef.current = result.center
                    initMap(result.center, result.data || [])
                }
            }
            setLoading(false)
        }
        load()

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (mapRef.current) (mapRef.current as any).remove()
        }
    }, [initMap])

    return (
        <div className="flex flex-col h-[100dvh]">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] bg-white z-10">
                <Link href="/app" className="p-2 -ml-2 hover:bg-[var(--neutral-100)] rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-base font-semibold">Referee Map</h1>
                    <p className="text-[10px] text-[var(--foreground-muted)]">
                        {referees.length} referee{referees.length !== 1 ? 's' : ''} nearby
                    </p>
                </div>
            </div>

            {/* Map */}
            <div className="flex-1 relative">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--neutral-50)]">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
                            <span className="text-sm text-[var(--foreground-muted)]">Loading map...</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--neutral-50)]">
                        <div className="text-center px-8">
                            <MapPin className="w-12 h-12 mx-auto mb-3 text-[var(--neutral-300)]" />
                            <p className="text-sm text-red-500 mb-2">{error}</p>
                            <Link href="/app/profile" className="text-sm font-medium text-[var(--brand-primary)] hover:underline">
                                Update profile
                            </Link>
                        </div>
                    </div>
                )}

                <div ref={mapContainer} className="w-full h-full" />
            </div>

            {/* Selected referee detail */}
            {selectedRef && (
                <div className="flex-shrink-0 p-4 border-t border-[var(--border-color)] bg-white safe-area-bottom">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-sm">{selectedRef.full_name}</p>
                            <p className="text-xs text-[var(--foreground-muted)]">
                                {selectedRef.distance_km} km away · Level {selectedRef.level || 'N/A'} · {Math.round(selectedRef.reliability_score)}% reliable
                            </p>
                        </div>
                        <button
                            onClick={() => setSelectedRef(null)}
                            className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
