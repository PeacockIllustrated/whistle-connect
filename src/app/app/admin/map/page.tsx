'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getAdminMapData, AdminMapReferee, AdminMapBooking } from './actions'
import { loadMapboxGL } from '@/lib/mapbox/loader'
import { getMapboxAccessToken, getMapboxStyle } from '@/lib/mapbox/env'
import { formatDate, formatTime, escapeHtml } from '@/lib/utils'
import { Loader2, MapPin, Filter, Users, CalendarDays, Eye } from 'lucide-react'

type LayerFilter = 'all' | 'referees' | 'bookings'
type RefereeFilter = 'all' | 'available' | 'verified' | 'fa_pending'
type BookingFilter = 'all' | 'pending' | 'offered' | 'confirmed' | 'completed' | 'sos'

export default function AdminMapPage() {
    const mapContainer = useRef<HTMLDivElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapRef = useRef<any>(null)
    const [referees, setReferees] = useState<AdminMapReferee[]>([])
    const [bookings, setBookings] = useState<AdminMapBooking[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showFilters, setShowFilters] = useState(false)
    const [layerFilter, setLayerFilter] = useState<LayerFilter>('all')
    const [refereeFilter, setRefereeFilter] = useState<RefereeFilter>('all')
    const [bookingFilter, setBookingFilter] = useState<BookingFilter>('all')

    const updateMapLayers = useCallback(() => {
        const map = mapRef.current
        if (!map || !map.isStyleLoaded()) return

        // Show/hide referee layers
        const showReferees = layerFilter === 'all' || layerFilter === 'referees'
        const refVisibility = showReferees ? 'visible' : 'none'
        if (map.getLayer('ref-clusters')) map.setLayoutProperty('ref-clusters', 'visibility', refVisibility)
        if (map.getLayer('ref-cluster-count')) map.setLayoutProperty('ref-cluster-count', 'visibility', refVisibility)
        if (map.getLayer('ref-glow')) map.setLayoutProperty('ref-glow', 'visibility', refVisibility)
        if (map.getLayer('ref-dots')) map.setLayoutProperty('ref-dots', 'visibility', refVisibility)

        // Show/hide booking layers
        const showBookings = layerFilter === 'all' || layerFilter === 'bookings'
        const bookVisibility = showBookings ? 'visible' : 'none'
        if (map.getLayer('booking-glow')) map.setLayoutProperty('booking-glow', 'visibility', bookVisibility)
        if (map.getLayer('booking-dots')) map.setLayoutProperty('booking-dots', 'visibility', bookVisibility)

        // Apply referee filter
        if (map.getSource('referees') && showReferees) {
            const filteredRefs = referees.filter(r => {
                if (refereeFilter === 'available') return r.is_available
                if (refereeFilter === 'verified') return r.verified
                if (refereeFilter === 'fa_pending') return r.fa_verification_status === 'pending'
                return true
            })

            const refGeojson = {
                type: 'FeatureCollection' as const,
                features: filteredRefs.map(r => ({
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [r.longitude, r.latitude] },
                    properties: {
                        id: r.id,
                        name: r.full_name,
                        level: r.level || 'N/A',
                        county: r.county || 'Unknown',
                        is_available: r.is_available,
                        verified: r.verified,
                        fa_status: r.fa_verification_status,
                        reliability: Math.round(r.reliability_score),
                        rating: r.average_rating,
                        matches: r.total_matches_completed,
                    },
                })),
            }
            map.getSource('referees').setData(refGeojson)
        }

        // Apply booking filter
        if (map.getSource('bookings') && showBookings) {
            const filteredBookings = bookings.filter(b => {
                if (bookingFilter === 'sos') return b.is_sos
                if (bookingFilter !== 'all') return b.status === bookingFilter
                return true
            })

            const bookGeojson = {
                type: 'FeatureCollection' as const,
                features: filteredBookings.map(b => ({
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [b.longitude, b.latitude] },
                    properties: {
                        id: b.id,
                        status: b.status,
                        title: b.home_team && b.away_team
                            ? `${b.home_team} vs ${b.away_team}`
                            : (b.address_text || b.ground_name || b.location_postcode),
                        match_date: b.match_date,
                        kickoff_time: b.kickoff_time,
                        format: b.format || '',
                        age_group: b.age_group || '',
                        is_sos: b.is_sos,
                        coach_name: b.coach_name || 'Unknown',
                        referee_name: b.referee_name || 'Unassigned',
                    },
                })),
            }
            map.getSource('bookings').setData(bookGeojson)
        }
    }, [layerFilter, refereeFilter, bookingFilter, referees, bookings])

    const initMap = useCallback(async (refs: AdminMapReferee[], books: AdminMapBooking[]) => {
        if (!mapContainer.current) return

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapboxgl = await loadMapboxGL() as any
            mapboxgl.accessToken = getMapboxAccessToken()

            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches

            // Calculate center from all data points
            const allPoints = [
                ...refs.map(r => ({ lat: r.latitude, lng: r.longitude })),
                ...books.map(b => ({ lat: b.latitude, lng: b.longitude })),
            ]

            // Default center: UK (lat 52.5, lng -1.5)
            let center = { lat: 52.5, lng: -1.5 }
            let zoom = 6

            if (allPoints.length > 0) {
                const avgLat = allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length
                const avgLng = allPoints.reduce((s, p) => s + p.lng, 0) / allPoints.length
                center = { lat: avgLat, lng: avgLng }
                zoom = allPoints.length > 50 ? 6 : allPoints.length > 10 ? 8 : 10
            }

            const map = new mapboxgl.Map({
                container: mapContainer.current,
                style: getMapboxStyle(isDark ? 'dark' : 'light'),
                center: [center.lng, center.lat],
                zoom,
            })

            mapRef.current = map

            map.addControl(new mapboxgl.NavigationControl(), 'top-right')

            map.on('load', () => {
                // ── Referee source (clustered) ──
                const refGeojson = {
                    type: 'FeatureCollection' as const,
                    features: refs.map(r => ({
                        type: 'Feature' as const,
                        geometry: { type: 'Point' as const, coordinates: [r.longitude, r.latitude] },
                        properties: {
                            id: r.id,
                            name: r.full_name,
                            level: r.level || 'N/A',
                            county: r.county || 'Unknown',
                            is_available: r.is_available,
                            verified: r.verified,
                            fa_status: r.fa_verification_status,
                            reliability: Math.round(r.reliability_score),
                            rating: r.average_rating,
                            matches: r.total_matches_completed,
                        },
                    })),
                }

                map.addSource('referees', {
                    type: 'geojson',
                    data: refGeojson,
                    cluster: true,
                    clusterMaxZoom: 14,
                    clusterRadius: 50,
                })

                // Referee clusters
                map.addLayer({
                    id: 'ref-clusters',
                    type: 'circle',
                    source: 'referees',
                    filter: ['has', 'point_count'],
                    paint: {
                        'circle-color': ['step', ['get', 'point_count'], '#10b981', 5, '#3b82f6', 10, '#8b5cf6'],
                        'circle-radius': ['step', ['get', 'point_count'], 18, 5, 24, 10, 30],
                        'circle-opacity': 0.85,
                    },
                })

                map.addLayer({
                    id: 'ref-cluster-count',
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

                // Individual referee glow + dots
                map.addLayer({
                    id: 'ref-glow',
                    type: 'circle',
                    source: 'referees',
                    filter: ['!', ['has', 'point_count']],
                    paint: {
                        'circle-radius': 16,
                        'circle-color': ['case', ['get', 'is_available'], '#10b981', '#94a3b8'],
                        'circle-opacity': 0.25,
                        'circle-blur': 0.8,
                    },
                })

                map.addLayer({
                    id: 'ref-dots',
                    type: 'circle',
                    source: 'referees',
                    filter: ['!', ['has', 'point_count']],
                    paint: {
                        'circle-radius': 7,
                        'circle-color': ['case', ['get', 'is_available'], '#10b981', '#94a3b8'],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff',
                    },
                })

                // ── Booking source (not clustered) ──
                const bookGeojson = {
                    type: 'FeatureCollection' as const,
                    features: books.map(b => ({
                        type: 'Feature' as const,
                        geometry: { type: 'Point' as const, coordinates: [b.longitude, b.latitude] },
                        properties: {
                            id: b.id,
                            status: b.status,
                            title: b.home_team && b.away_team
                                ? `${b.home_team} vs ${b.away_team}`
                                : (b.address_text || b.ground_name || b.location_postcode),
                            match_date: b.match_date,
                            kickoff_time: b.kickoff_time,
                            format: b.format || '',
                            age_group: b.age_group || '',
                            is_sos: b.is_sos,
                            coach_name: b.coach_name || 'Unknown',
                            referee_name: b.referee_name || 'Unassigned',
                        },
                    })),
                }

                map.addSource('bookings', { type: 'geojson', data: bookGeojson })

                // Booking glow
                map.addLayer({
                    id: 'booking-glow',
                    type: 'circle',
                    source: 'bookings',
                    paint: {
                        'circle-radius': 14,
                        'circle-color': [
                            'case',
                            ['get', 'is_sos'], '#ef4444',
                            ['==', ['get', 'status'], 'confirmed'], '#3b82f6',
                            ['==', ['get', 'status'], 'completed'], '#06b6d4',
                            '#f59e0b',
                        ],
                        'circle-opacity': 0.25,
                        'circle-blur': 0.8,
                    },
                })

                // Booking dots (diamond shape via icon would be ideal, but circle is simpler)
                map.addLayer({
                    id: 'booking-dots',
                    type: 'circle',
                    source: 'bookings',
                    paint: {
                        'circle-radius': 6,
                        'circle-color': [
                            'case',
                            ['get', 'is_sos'], '#ef4444',
                            ['==', ['get', 'status'], 'confirmed'], '#3b82f6',
                            ['==', ['get', 'status'], 'completed'], '#06b6d4',
                            '#f59e0b',
                        ],
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff',
                    },
                })

                // ── Interactions ──

                // Click on referee cluster → zoom
                map.on('click', 'ref-clusters', (e: { features?: { geometry: { coordinates: number[] }; properties: { cluster_id: number } }[] }) => {
                    const features = e.features
                    if (!features?.length) return
                    const clusterId = features[0].properties.cluster_id
                    map.getSource('referees').getClusterExpansionZoom(clusterId, (err: Error, z: number) => {
                        if (err) return
                        map.easeTo({ center: features[0].geometry.coordinates, zoom: z })
                    })
                })

                // Click on referee dot → popup
                map.on('click', 'ref-dots', (e: { features?: { properties: Record<string, string | number | boolean> }[]; lngLat: { lng: number; lat: number } }) => {
                    const features = e.features
                    if (!features?.length) return
                    const p = features[0].properties

                    const availDot = p.is_available
                        ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:5px;vertical-align:middle"></span>'
                        : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#94a3b8;margin-right:5px;vertical-align:middle"></span>'
                    const verifiedBadge = p.verified
                        ? ' · <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified'
                        : ''
                    const starIcon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="1" stroke-linejoin="round" style="vertical-align:middle;margin-right:2px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'

                    new mapboxgl.Popup({ offset: 25, closeButton: true })
                        .setLngLat([e.lngLat.lng, e.lngLat.lat])
                        .setHTML(`
                            <div style="font-family:system-ui;min-width:180px;font-size:13px">
                                <strong style="font-size:14px">${escapeHtml(p.name)}</strong>
                                <div style="color:#666;margin-top:4px">
                                    ${availDot}${p.is_available ? 'Available' : 'Unavailable'}${verifiedBadge}
                                </div>
                                <div style="color:#888;margin-top:2px;font-size:11px">
                                    Level ${escapeHtml(p.level)} · ${escapeHtml(p.county)}
                                </div>
                                <div style="color:#888;font-size:11px">
                                    ${escapeHtml(p.reliability)}% reliable · ${escapeHtml(p.matches)} matches
                                </div>
                                ${Number(p.rating) > 0 ? `<div style="color:#888;font-size:11px">${starIcon}${Number(p.rating).toFixed(1)} avg rating</div>` : ''}
                                <div style="margin-top:6px;font-size:11px;color:#999">FA: ${escapeHtml(p.fa_status)}</div>
                            </div>
                        `)
                        .addTo(map)
                })

                // Click on booking dot → popup
                map.on('click', 'booking-dots', (e: { features?: { properties: Record<string, string | number | boolean> }[]; lngLat: { lng: number; lat: number } }) => {
                    const features = e.features
                    if (!features?.length) return
                    const p = features[0].properties

                    const statusColors: Record<string, string> = {
                        pending: '#f59e0b', offered: '#f59e0b',
                        confirmed: '#3b82f6', completed: '#06b6d4',
                    }
                    const statusColor = statusColors[String(p.status)] || '#999'

                    new mapboxgl.Popup({ offset: 25, closeButton: true })
                        .setLngLat([e.lngLat.lng, e.lngLat.lat])
                        .setHTML(`
                            <div style="font-family:system-ui;min-width:180px;font-size:13px">
                                <strong style="font-size:14px">${escapeHtml(p.title)}</strong>
                                ${p.is_sos ? '<span style="background:#fee2e2;color:#dc2626;font-size:10px;padding:1px 6px;border-radius:4px;margin-left:4px;font-weight:600">SOS</span>' : ''}
                                <div style="margin-top:4px;color:#666">
                                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:4px;vertical-align:middle"></span>
                                    ${escapeHtml(String(p.status).charAt(0).toUpperCase() + String(p.status).slice(1))}
                                </div>
                                <div style="color:#888;margin-top:2px;font-size:11px;display:flex;align-items:center;gap:4px">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    <span>${formatDate(String(p.match_date))}</span>
                                    <span>·</span>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    <span>${formatTime(String(p.kickoff_time))}</span>
                                </div>
                                <div style="color:#888;font-size:11px">
                                    Coach: ${escapeHtml(p.coach_name)} · Ref: ${escapeHtml(p.referee_name)}
                                </div>
                                ${p.format ? `<div style="color:#999;font-size:11px">${escapeHtml(p.format)}${p.age_group ? ` · ${escapeHtml(p.age_group)}` : ''}</div>` : ''}
                            </div>
                        `)
                        .addTo(map)
                })

                // Cursors
                const layers = ['ref-clusters', 'ref-dots', 'booking-dots']
                layers.forEach(layer => {
                    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
                    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
                })
            })
        } catch (err) {
            console.error('Admin map init error:', err)
            setError('Failed to load map')
        }
    }, [])

    // Load data
    useEffect(() => {
        async function load() {
            const result = await getAdminMapData()
            if (result.error) {
                setError(result.error)
            } else {
                setReferees(result.referees || [])
                setBookings(result.bookings || [])
                initMap(result.referees || [], result.bookings || [])
            }
            setLoading(false)
        }
        load()

        return () => {
            if (mapRef.current) mapRef.current.remove()
        }
    }, [initMap])

    // Update layers when filters change
    useEffect(() => {
        updateMapLayers()
    }, [updateMapLayers])

    // Count helpers
    const availableCount = referees.filter(r => r.is_available).length
    const verifiedCount = referees.filter(r => r.verified).length
    const sosCount = bookings.filter(b => b.is_sos).length

    return (
        <div className="flex flex-col h-[100dvh]">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] bg-white z-20">
                <div className="flex-1">
                    <h1 className="text-base font-semibold">Admin Map</h1>
                    <p className="text-[10px] text-[var(--foreground-muted)]">
                        {referees.length} referees · {bookings.length} bookings
                    </p>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--neutral-100)] text-[var(--foreground-muted)]'}`}
                >
                    <Filter className="w-5 h-5" />
                </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border-color)] bg-[var(--neutral-50)] z-10 space-y-3">
                    {/* Layer toggle */}
                    <div>
                        <p className="text-[10px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-1.5">Show</p>
                        <div className="flex gap-1.5">
                            {([
                                { value: 'all' as LayerFilter, label: 'All', icon: Eye },
                                { value: 'referees' as LayerFilter, label: `Referees (${referees.length})`, icon: Users },
                                { value: 'bookings' as LayerFilter, label: `Bookings (${bookings.length})`, icon: CalendarDays },
                            ]).map((opt) => {
                                const Icon = opt.icon
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => setLayerFilter(opt.value)}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                            layerFilter === opt.value
                                                ? 'bg-[var(--brand-primary)] text-white'
                                                : 'bg-white text-[var(--foreground-muted)] border border-[var(--border-color)]'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Referee filters */}
                    {(layerFilter === 'all' || layerFilter === 'referees') && (
                        <div>
                            <p className="text-[10px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-1.5">Referees</p>
                            <div className="flex gap-1.5 flex-wrap">
                                {([
                                    { value: 'all' as RefereeFilter, label: 'All' },
                                    { value: 'available' as RefereeFilter, label: `Available (${availableCount})` },
                                    { value: 'verified' as RefereeFilter, label: `Verified (${verifiedCount})` },
                                    { value: 'fa_pending' as RefereeFilter, label: 'FA Pending' },
                                ]).map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setRefereeFilter(opt.value)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                            refereeFilter === opt.value
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-white text-[var(--foreground-muted)] border border-[var(--border-color)]'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Booking filters */}
                    {(layerFilter === 'all' || layerFilter === 'bookings') && (
                        <div>
                            <p className="text-[10px] font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-1.5">Bookings</p>
                            <div className="flex gap-1.5 flex-wrap">
                                {([
                                    { value: 'all' as BookingFilter, label: 'All' },
                                    { value: 'pending' as BookingFilter, label: 'Pending' },
                                    { value: 'offered' as BookingFilter, label: 'Offered' },
                                    { value: 'confirmed' as BookingFilter, label: 'Confirmed' },
                                    { value: 'sos' as BookingFilter, label: `SOS (${sosCount})` },
                                ]).map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setBookingFilter(opt.value)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                            bookingFilter === opt.value
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white text-[var(--foreground-muted)] border border-[var(--border-color)]'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Legend */}
            <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 border-b border-[var(--border-color)] bg-white/80 backdrop-blur-sm z-10">
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--foreground-muted)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Available Ref
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--foreground-muted)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    Unavailable Ref
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--foreground-muted)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    Pending Booking
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--foreground-muted)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    Confirmed
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--foreground-muted)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    SOS
                </div>
            </div>

            {/* Map */}
            <div className="flex-1 relative">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--neutral-50)]">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
                            <span className="text-sm text-[var(--foreground-muted)]">Loading admin map...</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--neutral-50)]">
                        <div className="text-center px-8">
                            <MapPin className="w-12 h-12 mx-auto mb-3 text-[var(--neutral-300)]" />
                            <p className="text-sm text-red-500 mb-2">{error}</p>
                        </div>
                    </div>
                )}

                <div ref={mapContainer} className="w-full h-full" />
            </div>
        </div>
    )
}
