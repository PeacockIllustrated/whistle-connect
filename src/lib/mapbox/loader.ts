/* eslint-disable @typescript-eslint/no-explicit-any */

const MAPBOX_VERSION = '3.9.3'

let loadPromise: Promise<any> | null = null

/**
 * Lazily load Mapbox GL JS from CDN.
 * Returns the global mapboxgl object once ready.
 * Idempotent: multiple calls share the same promise.
 */
export function loadMapboxGL(): Promise<any> {
    if (loadPromise) return loadPromise

    loadPromise = new Promise((resolve, reject) => {
        // Already loaded
        if (typeof window !== 'undefined' && (window as any).mapboxgl) {
            resolve((window as any).mapboxgl)
            return
        }

        // Load CSS
        if (!document.querySelector('link[href*="mapbox-gl"]')) {
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_VERSION}/mapbox-gl.css`
            document.head.appendChild(link)
        }

        // Load JS
        const script = document.createElement('script')
        script.src = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_VERSION}/mapbox-gl.js`
        script.async = true
        script.onload = () => {
            if ((window as any).mapboxgl) {
                resolve((window as any).mapboxgl)
            } else {
                reject(new Error('mapboxgl not found after script load'))
            }
        }
        script.onerror = () => reject(new Error('Failed to load Mapbox GL JS'))
        document.head.appendChild(script)
    })

    return loadPromise
}
