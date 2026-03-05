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
 * After uploading, copy the two Style URLs and update src/components/ui/VenueMap.tsx
 */

import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Brand palette ───────────────────────────────────────────────────────
const BRAND = {
    navy: '#1b2537',
    red: '#cd1719',
    // Slate scale (matches Tailwind + app CSS vars)
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
    // Land & background
    background: BRAND.slate50,
    landuse_park: '#d6e5d0',
    landuse_pitch: '#cde0c8',
    landuse_hospital: '#f3e8e8',
    landuse_school: '#eee8f0',
    landuse_commercial: BRAND.slate100,

    // Water
    water: '#c1d4e6',
    waterway: '#aac4db',

    // Buildings
    building: '#dfe4ea',
    building_outline: '#cdd3db',

    // Roads
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

    // Labels
    label_primary: BRAND.navy,
    label_secondary: BRAND.slate600,
    label_tertiary: BRAND.slate400,
    label_halo: '#ffffff',

    // Boundaries
    boundary: BRAND.slate300,
}

// ── Dark theme colour overrides ─────────────────────────────────────────
const DARK_OVERRIDES = {
    background: BRAND.navy,
    landuse_park: '#1a2e1f',
    landuse_pitch: '#1c3022',
    landuse_hospital: '#2a1f2a',
    landuse_school: '#251f2e',
    landuse_commercial: '#1f2d3f',

    water: '#0f1a2a',
    waterway: '#0c1624',

    building: '#243044',
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

// ── Apply brand overrides to a Mapbox style ─────────────────────────────
function applyBranding(style, overrides, themeName) {
    // Remove owner/id so Mapbox Studio treats it as a new style on upload
    delete style.owner
    delete style.id
    delete style.created
    delete style.modified
    delete style.draft

    style.name = `Whistle Connect ${themeName}`

    for (const layer of style.layers) {
        const id = layer.id || ''
        const type = layer.type || ''

        // ── Background ──
        if (type === 'background') {
            setPaint(layer, 'background-color', overrides.background)
            continue
        }

        // ── Water ──
        if (id === 'water' || id.startsWith('water-')) {
            if (id.includes('shadow')) continue
            setPaint(layer, 'fill-color', overrides.water)
            continue
        }
        if (id.includes('waterway')) {
            setPaint(layer, 'line-color', overrides.waterway)
            continue
        }

        // ── Land use ──
        if (id.includes('landuse') || id.includes('land-use')) {
            applyLanduseColors(layer, overrides)
            continue
        }
        if (id.includes('park') || id.includes('pitch') || id.includes('sport')) {
            setPaintSafe(layer, 'fill-color', overrides.landuse_park)
            continue
        }
        if (id.includes('national-park')) {
            setPaintSafe(layer, 'fill-color', overrides.landuse_park)
            continue
        }

        // ── Buildings ──
        if (id.includes('building')) {
            if (type === 'fill' || type === 'fill-extrusion') {
                setPaintSafe(layer, 'fill-color', overrides.building)
                setPaintSafe(layer, 'fill-extrusion-color', overrides.building)
                setPaintSafe(layer, 'fill-outline-color', overrides.building_outline)
            }
            continue
        }

        // ── Roads ──
        if (isRoadLayer(id)) {
            applyRoadColors(layer, id, overrides)
            continue
        }

        // ── Boundaries ──
        if (id.includes('boundary') || id.includes('admin')) {
            if (type === 'line') {
                setPaintSafe(layer, 'line-color', overrides.boundary)
            }
            continue
        }

        // ── Labels ──
        if (type === 'symbol' && layer.paint) {
            applyLabelColors(layer, id, overrides)
            continue
        }
    }

    return style
}

// ── Road colour helpers ─────────────────────────────────────────────────
function isRoadLayer(id) {
    return id.includes('road') || id.includes('bridge') || id.includes('tunnel') ||
        id.includes('turning') || id.includes('link')
}

function applyRoadColors(layer, id, o) {
    const isCasing = id.includes('case') || id.includes('casing')
    const isLine = layer.type === 'line'

    if (!isLine) return

    if (id.includes('motorway')) {
        setPaintSafe(layer, 'line-color', isCasing ? o.road_motorway_casing : o.road_motorway)
    } else if (id.includes('trunk')) {
        setPaintSafe(layer, 'line-color', isCasing ? o.road_trunk_casing : o.road_trunk)
    } else if (id.includes('primary')) {
        setPaintSafe(layer, 'line-color', isCasing ? o.road_primary_casing : o.road_primary)
    } else if (id.includes('secondary') || id.includes('tertiary')) {
        setPaintSafe(layer, 'line-color', isCasing ? o.road_secondary_casing : o.road_secondary)
    } else if (id.includes('street') || id.includes('residential')) {
        setPaintSafe(layer, 'line-color', isCasing ? o.road_street_casing : o.road_street)
    } else if (id.includes('path') || id.includes('pedestrian') || id.includes('cycleway')) {
        setPaintSafe(layer, 'line-color', o.road_path)
    } else {
        // Minor / service / other
        setPaintSafe(layer, 'line-color', isCasing ? o.road_minor_casing : o.road_minor)
    }
}

// ── Landuse colour helpers ──────────────────────────────────────────────
function applyLanduseColors(layer, o) {
    if (layer.type !== 'fill') return
    // Try to detect sub-type from filter
    const filterStr = JSON.stringify(layer.filter || [])

    if (filterStr.includes('park') || filterStr.includes('pitch') || filterStr.includes('grass') ||
        filterStr.includes('cemetery') || filterStr.includes('golf')) {
        setPaintSafe(layer, 'fill-color', o.landuse_park)
    } else if (filterStr.includes('hospital') || filterStr.includes('medical')) {
        setPaintSafe(layer, 'fill-color', o.landuse_hospital)
    } else if (filterStr.includes('school') || filterStr.includes('university') || filterStr.includes('education')) {
        setPaintSafe(layer, 'fill-color', o.landuse_school)
    } else if (filterStr.includes('commercial') || filterStr.includes('retail') || filterStr.includes('industrial')) {
        setPaintSafe(layer, 'fill-color', o.landuse_commercial)
    } else {
        // Generic landuse — use park color as a safe neutral-green
        setPaintSafe(layer, 'fill-color', o.landuse_park)
    }
}

// ── Label colour helpers ────────────────────────────────────────────────
function applyLabelColors(layer, id, o) {
    if (!layer.paint) return

    // Determine label importance
    const isPrimary = id.includes('place-city') || id.includes('place-town') ||
        id.includes('country') || id.includes('state') || id.includes('continent')
    const isTertiary = id.includes('poi') || id.includes('transit') ||
        id.includes('natural') || id.includes('water-')

    const textColor = isPrimary ? o.label_primary
        : isTertiary ? o.label_tertiary
            : o.label_secondary

    setPaintSafe(layer, 'text-color', textColor)
    setPaintSafe(layer, 'text-halo-color', o.label_halo)
}

// ── Safe paint setters ──────────────────────────────────────────────────
function setPaint(layer, prop, value) {
    if (!layer.paint) layer.paint = {}
    layer.paint[prop] = value
}

function setPaintSafe(layer, prop, value) {
    if (!layer.paint) return
    // Only override if the property already exists (don't add unexpected props)
    if (prop in layer.paint) {
        // If the current value is an expression/stops array, replace with a simple value
        // This works for most cases; complex zoom-dependent styles may need manual tuning
        const current = layer.paint[prop]
        if (Array.isArray(current) && current.length > 0 && typeof current[0] === 'string' &&
            (current[0] === 'interpolate' || current[0] === 'step' || current[0] === 'match' || current[0] === 'case')) {
            // Replace expression with flat colour
            layer.paint[prop] = value
        } else {
            layer.paint[prop] = value
        }
    }
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

    const lightBranded = applyBranding(lightBase, LIGHT_OVERRIDES, 'Light')
    const darkBranded = applyBranding(darkBase, DARK_OVERRIDES, 'Dark')

    const lightPath = resolve(__dirname, 'mapbox-style-light.json')
    const darkPath = resolve(__dirname, 'mapbox-style-dark.json')

    writeFileSync(lightPath, JSON.stringify(lightBranded, null, 2))
    writeFileSync(darkPath, JSON.stringify(darkBranded, null, 2))

    console.log(`  Wrote: ${lightPath}`)
    console.log(`  Wrote: ${darkPath}\n`)

    console.log('Next steps:')
    console.log('  1. Go to https://studio.mapbox.com/styles')
    console.log('  2. Click "New style" → "Upload" → select mapbox-style-light.json')
    console.log('  3. Preview and hit "Publish"')
    console.log('  4. Repeat for mapbox-style-dark.json')
    console.log('  5. Copy both Style URLs (e.g. mapbox://styles/yourname/abc123)')
    console.log('  6. Update the style URLs in src/components/ui/VenueMap.tsx')
    console.log('')
}

main().catch((err) => {
    console.error('Error:', err.message)
    process.exit(1)
})
