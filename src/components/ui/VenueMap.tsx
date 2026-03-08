'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { loadMapboxGL } from '@/lib/mapbox/loader'
import { geocodePostcode } from '@/lib/mapbox/geocode'
import { getMapboxAccessToken, getMapboxStyle } from '@/lib/mapbox/env'
import { MapPin } from 'lucide-react'

interface VenueMapProps {
    /** UK postcode to display on the map */
    postcode: string
    /** Map height in pixels */
    height?: number
    /** Enable zoom/pan gestures (default: false for compact views) */
    interactive?: boolean
    /** Additional Tailwind classes */
    className?: string
}

type MapState = 'loading' | 'ready' | 'error'

const MARKER_SVG = `
<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="#cd1719"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
</svg>
`

export function VenueMap({
    postcode,
    height = 200,
    interactive = false,
    className,
}: VenueMapProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<any>(null)
    const markerRef = useRef<any>(null)
    const [state, setState] = useState<MapState>('loading')

    // Derive whether the postcode is valid from the prop (no effect needed)
    const hasValidPostcode = useMemo(
        () => Boolean(postcode && postcode.trim().length >= 3),
        [postcode]
    )

    /** Detect if the dark "midnight" theme is active */
    const isDarkTheme = useCallback(() => {
        if (typeof document === 'undefined') return false
        return document.documentElement.getAttribute('data-color') === 'midnight'
    }, [])

    useEffect(() => {
        if (!hasValidPostcode) return

        let cancelled = false

        async function init() {
            try {
                setState('loading')

                const mbgl = await loadMapboxGL()
                const coords = await geocodePostcode(postcode)
                if (cancelled) return

                if (!coords) {
                    setState('error')
                    return
                }

                mbgl.accessToken = getMapboxAccessToken()

                // If map already exists, just update position
                if (mapRef.current) {
                    mapRef.current.setCenter([coords.lng, coords.lat])
                    if (markerRef.current) {
                        markerRef.current.setLngLat([coords.lng, coords.lat])
                    }
                    setState('ready')
                    return
                }

                if (!containerRef.current) return

                const dark = isDarkTheme()
                const map = new mbgl.Map({
                    container: containerRef.current,
                    style: getMapboxStyle(dark ? 'dark' : 'light'),
                    center: [coords.lng, coords.lat],
                    zoom: 14,
                    interactive,
                    attributionControl: false,
                    ...(interactive ? {} : {
                        scrollZoom: false,
                        boxZoom: false,
                        dragRotate: false,
                        dragPan: false,
                        keyboard: false,
                        doubleClickZoom: false,
                        touchZoomRotate: false,
                        touchPitch: false,
                    }),
                })

                map.addControl(
                    new mbgl.AttributionControl({ compact: true }),
                    'bottom-right'
                )

                // Custom brand marker
                const markerEl = document.createElement('div')
                markerEl.innerHTML = MARKER_SVG
                markerEl.style.cursor = interactive ? 'grab' : 'default'

                const marker = new mbgl.Marker({ element: markerEl })
                    .setLngLat([coords.lng, coords.lat])
                    .addTo(map)

                mapRef.current = map
                markerRef.current = marker

                map.on('load', () => {
                    if (!cancelled) setState('ready')
                })

                // In case load already fired
                if (map.loaded()) {
                    setState('ready')
                }
            } catch {
                if (!cancelled) setState('error')
            }
        }

        init()

        return () => {
            cancelled = true
        }
    }, [postcode, hasValidPostcode, interactive, isDarkTheme])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mapRef.current) {
                mapRef.current.remove()
                mapRef.current = null
                markerRef.current = null
            }
        }
    }, [])

    // ── No postcode placeholder ──
    if (!hasValidPostcode) {
        return (
            <div
                className={cn(
                    'rounded-xl overflow-hidden border border-[var(--border-color)]',
                    'bg-[var(--neutral-100)] flex items-center justify-center',
                    className
                )}
                style={{ height }}
            >
                <div className="text-center text-[var(--foreground-muted)]">
                    <MapPin className="w-6 h-6 mx-auto mb-1 opacity-40" />
                    <p className="text-xs">Enter a postcode to see the map</p>
                </div>
            </div>
        )
    }

    // ── Error state ──
    if (state === 'error') {
        return (
            <div
                className={cn(
                    'rounded-xl overflow-hidden border border-[var(--border-color)]',
                    'bg-[var(--neutral-100)] flex items-center justify-center',
                    className
                )}
                style={{ height }}
            >
                <div className="text-center text-[var(--foreground-muted)]">
                    <MapPin className="w-6 h-6 mx-auto mb-1 opacity-40" />
                    <p className="text-xs">Could not load map for this postcode</p>
                </div>
            </div>
        )
    }

    return (
        <div className={cn('relative rounded-xl overflow-hidden border border-[var(--border-color)]', className)}>
            {/* Loading skeleton */}
            {state === 'loading' && (
                <div
                    className="absolute inset-0 z-10 animate-pulse bg-[var(--neutral-200)]"
                    style={{ borderRadius: 'inherit' }}
                />
            )}
            {/* Map container */}
            <div ref={containerRef} style={{ width: '100%', height }} />
        </div>
    )
}
