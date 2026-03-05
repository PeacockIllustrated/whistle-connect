#!/usr/bin/env node

/**
 * Generate branded Mapbox style JSON files for Whistle Connect.
 *
 * Usage:
 *   node scripts/generate-mapbox-styles.mjs <MAPBOX_ACCESS_TOKEN>
 *
 * Outputs:
 *   scripts/mapbox-style-light.json  — Upload to Mapbox Studio as "Whistle Connect Light"
 *   scripts/mapbox-style-dark.json   — Upload to Mapbox Studio as "Whistle Connect Dark"
 *
 * After uploading, copy the two Style URLs and update your env vars:
 *   NEXT_PUBLIC_MAPBOX_STYLE_LIGHT=mapbox://styles/yourname/abc123
 *   NEXT_PUBLIC_MAPBOX_STYLE_DARK=mapbox://styles/yourname/def456
 */

import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Valid paint properties per layer type (Mapbox Style Spec) ───────────
const VALID_PAINT = {
    background: ['background-color', 'background-opacity', 'background-pattern'],
    fill: ['fill-color', 'fill-opacity', 'fill-outline-color', 'fill-pattern', 'fill-antialias', 'fill-translate', 'fill-translate-anchor'],
    line: ['line-color', 'line-opacity', 'line-width', 'line-gap-width', 'line-offset', 'line-blur', 'line-dasharray', 'line-pattern', 'line-translate', 'line-translate-anchor', 'line-gradient'],
    symbol: ['text-color', 'text-opacity', 'text-halo-color', 'text-halo-width', 'text-halo-blur', 'text-translate', 'icon-color', 'icon-opacity', 'icon-halo-color', 'icon-halo-width', 'icon-halo-blur', 'icon-translate'],
    'fill-extrusion': ['fill-extrusion-color', 'fill-extrusion-opacity', 'fill-extrusion-height', 'fill-extrusion-base', 'fill-extrusion-pattern', 'fill-extrusion-translate', 'fill-extrusion-translate-anchor', 'fill-extrusion-vertical-gradient'],
    circle: ['circle-color', 'circle-opacity', 'circle-radius', 'circle-stroke-color', 'circle-stroke-opacity', 'circle-stroke-width', 'circle-blur', 'circle-translate', 'circle-translate-anchor', 'circle-pitch-scale', 'circle-pitch-alignment'],
    raster: ['raster-opacity', 'raster-brightness-min', 'raster-brightness-max', 'raster-contrast', 'raster-fade-duration', 'raster-hue-rotate', 'raster-resampling', 'raster-saturation'],
    hillshade: ['hillshade-accent-color', 'hillshade-exaggeration', 'hillshade-highlight-color', 'hillshade-illumination-anchor', 'hillshade-illumination-direction', 'hillshade-shadow-color'],
    heatmap: ['heatmap-color', 'heatmap-intensity', 'heatmap-opacity', 'heatmap-radius', 'heatmap-weight'],
}

// ── Brand palette ───────────────────────────────────────────────────────
const BRAND = {
    navy: '#1b2537',
    red: '#cd1719',
    slate50: '#f8fafc',
    slate100: '#f1f5f9',
    slate200: '#e2e8f0',
    slate300: '#cbd5e1',
    slate400: '#94a3b8',
    slate500: '#64748b',
    slate600: '#475569',
    slate700: '#334155',
    slate800: '#1e293b',
    slate900: '#0f172a',
}

// ── Light theme colour overrides ────────────────────────────────────────
const LIGHT_OVERRIDES = {
    background: BRAND.slate50,
    landuse_park: '#d6e5d0',
    landuse_hospital: '#f3e8e8',
    landuse_school: '#eee8f0',
    landuse_commercial: BRAND.slate100,
    water_fill: '#c1d4e6',
    waterway_line: '#aac4db',
    building_fill: '#dfe4ea',
    building_outline: '#cdd3db',
    road_motorway: '#ffffff',
    road_motorway_casing: BRAND.slate300,
    road_trunk: '#ffffff',
    road_trunk_casing: BRAND.slate300,
    road_primary: '#ffffff',
    road_primary_casing: BRAND.slate200,
    road_secondary: BRAND.slate50,
    road_secondary_casing: BRAND.slate200,
    road_street: '#ffffff',
    road_street_casing: BRAND.slate100,
    road_minor: '#ffffff',
    road_minor_casing: BRAND.slate100,
    road_path: BRAND.slate200,
    label_primary: BRAND.navy,
    label_secondary: BRAND.slate600,
    label_tertiary: BRAND.slate400,
    label_halo: '#ffffff',
    boundary: BRAND.slate300,
}

// ── Dark theme colour overrides ─────────────────────────────────────────
const DARK_OVERRIDES = {
    background: BRAND.navy,
    landuse_park: '#1a2e1f',
    landuse_hospital: '#2a1f2a',
    landuse_school: '#251f2e',
    landuse_commercial: '#1f2d3f',
    water_fill: '#0f1a2a',
    waterway_line: '#0c1624',
    building_fill: '#243044',
    building_outline: '#1b2537',
    road_motorway: '#3a4f68',
    road_motorway_casing: BRAND.navy,
    road_trunk: '#354a62',
    road_trunk_casing: BRAND.navy,
    road_primary: '#2f4259',
    road_primary_casing: '#1b2537',
    road_secondary: '#283a50',
    road_secondary_casing: '#1f2d3f',
    road_street: '#253648',
    road_street_casing: '#1f2d3f',
    road_minor: '#22303f',
    road_minor_casing: '#1b2537',
    road_path: '#2a3d52',
    label_primary: BRAND.slate200,
    label_secondary: BRAND.slate400,
    label_tertiary: BRAND.slate500,
    label_halo: '#0f172a',
    boundary: '#2a3d52',
}

// ── Fetch base style from Mapbox API ────────────────────────────────────
async function fetchBaseStyle(styleId, token) {
    const url = `https://api.mapbox.com/styles/v1/mapbox/${styleId}?access_token=${token}`
    const res = await fetch(url)
    if (!res.ok) {
        throw new Error(`Failed to fetch style "${styleId}": ${res.status} ${res.statusText}`)
    }
    return res.json()
}

// ── Type-safe paint setter ──────────────────────────────────────────────
// Only sets the property if (a) it's valid for the layer type AND (b) it
// already exists in the paint object (so we only override, never invent).
function safeSet(layer, prop, value) {
    const type = layer.type || ''
    const validProps = VALID_PAINT[type]
    if (!validProps || !validProps.includes(prop)) return // invalid for this layer type
    if (!layer.paint) return
    if (!(prop in layer.paint)) return // property doesn't exist in base style
    layer.paint[prop] = value
}

// ── Apply brand overrides to a Mapbox style ─────────────────────────────
function applyBranding(style, o, themeName) {
    // Strip metadata so Studio treats it as a new style
    delete style.owner
    delete style.id
    delete style.created
    delete style.modified
    delete style.draft

    style.name = `Whistle Connect ${themeName}`

    let modified = 0

    for (const layer of style.layers) {
        const id = layer.id || ''
        const type = layer.type || ''

        // ── Background ──
        if (type === 'background') {
            safeSet(layer, 'background-color', o.background)
            modified++
            continue
        }

        // ── Water (fill layers only) ──
        if ((id === 'water' || id.startsWith('water-')) && !id.includes('shadow')) {
            if (type === 'fill') {
                safeSet(layer, 'fill-color', o.water_fill)
                modified++
            }
            continue
        }

        // ── Waterways (line layers only) ──
        if (id.includes('waterway')) {
            if (type === 'line') {
                safeSet(layer, 'line-color', o.waterway_line)
                modified++
            }
            continue
        }

        // ── Land use (fill layers only) ──
        if (type === 'fill' && (id.includes('landuse') || id.includes('land-use') ||
            id.includes('park') || id.includes('pitch') || id.includes('national-park'))) {
            const filterStr = JSON.stringify(layer.filter || [])
            if (filterStr.includes('hospital') || filterStr.includes('medical')) {
                safeSet(layer, 'fill-color', o.landuse_hospital)
            } else if (filterStr.includes('school') || filterStr.includes('university') || filterStr.includes('education')) {
                safeSet(layer, 'fill-color', o.landuse_school)
            } else if (filterStr.includes('commercial') || filterStr.includes('retail') || filterStr.includes('industrial')) {
                safeSet(layer, 'fill-color', o.landuse_commercial)
            } else {
                safeSet(layer, 'fill-color', o.landuse_park)
            }
            modified++
            continue
        }

        // ── Buildings (fill / fill-extrusion only) ──
        if (id.includes('building')) {
            if (type === 'fill') {
                safeSet(layer, 'fill-color', o.building_fill)
                safeSet(layer, 'fill-outline-color', o.building_outline)
                modified++
            } else if (type === 'fill-extrusion') {
                safeSet(layer, 'fill-extrusion-color', o.building_fill)
                modified++
            }
            continue
        }

        // ── Roads (line layers only) ──
        if (type === 'line' && isRoadLayer(id)) {
            const isCasing = id.includes('case') || id.includes('casing')

            if (id.includes('motorway')) {
                safeSet(layer, 'line-color', isCasing ? o.road_motorway_casing : o.road_motorway)
            } else if (id.includes('trunk')) {
                safeSet(layer, 'line-color', isCasing ? o.road_trunk_casing : o.road_trunk)
            } else if (id.includes('primary')) {
                safeSet(layer, 'line-color', isCasing ? o.road_primary_casing : o.road_primary)
            } else if (id.includes('secondary') || id.includes('tertiary')) {
                safeSet(layer, 'line-color', isCasing ? o.road_secondary_casing : o.road_secondary)
            } else if (id.includes('street') || id.includes('residential')) {
                safeSet(layer, 'line-color', isCasing ? o.road_street_casing : o.road_street)
            } else if (id.includes('path') || id.includes('pedestrian') || id.includes('cycleway')) {
                safeSet(layer, 'line-color', o.road_path)
            } else {
                safeSet(layer, 'line-color', isCasing ? o.road_minor_casing : o.road_minor)
            }
            modified++
            continue
        }

        // ── Boundaries (line layers only) ──
        if (type === 'line' && (id.includes('boundary') || id.includes('admin'))) {
            safeSet(layer, 'line-color', o.boundary)
            modified++
            continue
        }

        // ── Labels (symbol layers only) ──
        if (type === 'symbol' && layer.paint) {
            const isPrimary = id.includes('place-city') || id.includes('place-town') ||
                id.includes('country') || id.includes('state') || id.includes('continent')
            const isTertiary = id.includes('poi') || id.includes('transit') ||
                id.includes('natural') || id.includes('water-')

            const textColor = isPrimary ? o.label_primary
                : isTertiary ? o.label_tertiary
                    : o.label_secondary

            safeSet(layer, 'text-color', textColor)
            safeSet(layer, 'text-halo-color', o.label_halo)
            modified++
            continue
        }
    }

    return { style, modified }
}

function isRoadLayer(id) {
    return id.includes('road') || id.includes('bridge') || id.includes('tunnel') ||
        id.includes('turning') || id.includes('link')
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
    const token = process.argv[2] || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

    if (!token) {
        console.error('\nUsage: node scripts/generate-mapbox-styles.mjs <MAPBOX_ACCESS_TOKEN>\n')
        console.error('Or set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your environment.\n')
        process.exit(1)
    }

    console.log('Fetching base styles from Mapbox API...\n')

    const [lightBase, darkBase] = await Promise.all([
        fetchBaseStyle('light-v11', token),
        fetchBaseStyle('dark-v11', token),
    ])

    console.log(`  Light base: ${lightBase.layers.length} layers`)
    console.log(`  Dark base:  ${darkBase.layers.length} layers\n`)

    console.log('Applying Whistle Connect branding...\n')

    const light = applyBranding(lightBase, LIGHT_OVERRIDES, 'Light')
    const dark = applyBranding(darkBase, DARK_OVERRIDES, 'Dark')

    console.log(`  Light: ${light.modified} layers modified`)
    console.log(`  Dark:  ${dark.modified} layers modified\n`)

    const lightPath = resolve(__dirname, 'mapbox-style-light.json')
    const darkPath = resolve(__dirname, 'mapbox-style-dark.json')

    writeFileSync(lightPath, JSON.stringify(light.style, null, 2))
    writeFileSync(darkPath, JSON.stringify(dark.style, null, 2))

    console.log(`  Wrote: ${lightPath}`)
    console.log(`  Wrote: ${darkPath}\n`)

    console.log('Next steps:')
    console.log('  1. Go to https://studio.mapbox.com/styles')
    console.log('  2. Click "New style" → "Upload" → select mapbox-style-light.json')
    console.log('  3. Preview and hit "Publish"')
    console.log('  4. Repeat for mapbox-style-dark.json')
    console.log('  5. Copy both Style URLs (e.g. mapbox://styles/yourname/abc123)')
    console.log('  6. Add to .env.local and Vercel:')
    console.log('     NEXT_PUBLIC_MAPBOX_STYLE_LIGHT=mapbox://styles/yourname/abc123')
    console.log('     NEXT_PUBLIC_MAPBOX_STYLE_DARK=mapbox://styles/yourname/def456')
    console.log('')
}

main().catch((err) => {
    console.error('Error:', err.message)
    process.exit(1)
})
