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

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

// Load .env / .env.local so the script can read NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
for (const envFile of ['.env', '.env.local']) {
    try {
        const content = readFileSync(resolve(rootDir, envFile), 'utf8')
        for (const line of content.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue
            const idx = trimmed.indexOf('=')
            if (idx === -1) continue
            const key = trimmed.slice(0, idx).trim()
            const val = trimmed.slice(idx + 1).trim()
            if (!process.env[key]) process.env[key] = val
        }
    } catch { /* file doesn't exist, skip */ }
}

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
    navyLight: '#253550',
    red: '#cd1719',
    redLight: '#e84244',
    redSoft: '#f2d4d4',     // Soft red tint for light backgrounds
    redMuted: '#3d1a1a',    // Muted red for dark backgrounds
    green: '#22c55e',       // Pitch green — vivid
    greenLight: '#bbf7d0',  // Pitch fill — light mode
    greenMid: '#4ade80',    // Pitch accent
    greenDark: '#15532e',   // Pitch fill — dark mode
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
    // Land use — parks vs pitches are handled separately in applyBranding
    landuse_park: '#d1e3cb',
    landuse_pitch: BRAND.greenLight,       // Vivid green for football grounds
    landuse_pitch_outline: BRAND.red,      // Brand red outline
    landuse_hospital: '#f3e8e8',
    landuse_school: '#eee8f0',
    landuse_commercial: BRAND.slate100,
    // Water — navy-tinted to feel more on-brand
    water_fill: '#b4c8e0',
    waterway_line: '#9ab6d4',
    // Buildings
    building_fill: '#dce2ea',
    building_outline: '#c5cdd8',
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
    boundary: BRAND.slate300,
}

// ── Dark theme colour overrides ─────────────────────────────────────────
const DARK_OVERRIDES = {
    background: BRAND.navy,
    landuse_park: '#162419',
    landuse_pitch: BRAND.greenDark,        // Rich green for pitches in dark mode
    landuse_pitch_outline: BRAND.redLight,  // Brighter red for dark mode visibility
    landuse_hospital: '#2a1f2a',
    landuse_school: '#251f2e',
    landuse_commercial: '#1f2d3f',
    water_fill: '#0c1525',
    waterway_line: '#091220',
    building_fill: '#213044',
    building_outline: BRAND.navy,
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
    let landuseInsertIndex = -1

    for (let i = 0; i < style.layers.length; i++) {
        const layer = style.layers[i]
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

        // ── Land use — special handling for pitch vs everything else ──
        if (type === 'fill' && (id.includes('landuse') || id.includes('land-use') ||
            id.includes('park') || id.includes('pitch') || id.includes('national-park'))) {
            const filterStr = JSON.stringify(layer.filter || [])

            if (filterStr.includes('hospital') || filterStr.includes('medical')) {
                safeSet(layer, 'fill-color', o.landuse_hospital)
            } else if (filterStr.includes('school') || filterStr.includes('university') || filterStr.includes('education')) {
                safeSet(layer, 'fill-color', o.landuse_school)
            } else if (filterStr.includes('commercial') || filterStr.includes('retail') || filterStr.includes('industrial')) {
                safeSet(layer, 'fill-color', o.landuse_commercial)
            } else if (filterStr.includes('pitch')) {
                // This is the main landuse layer which contains "pitch" as a class.
                // Use a match expression so pitches get a vivid brand green
                // while parks/grass/etc keep the muted green.
                layer.paint['fill-color'] = [
                    'match', ['get', 'class'],
                    'pitch', o.landuse_pitch,
                    o.landuse_park,
                ]

                // Boost pitch opacity so they really stand out
                layer.paint['fill-opacity'] = [
                    'interpolate', ['linear'], ['zoom'],
                    8, ['match', ['get', 'class'],
                        ['residential', 'airport'], 0.8,
                        'pitch', 0.6,
                        0.2],
                    12, ['match', ['get', 'class'],
                        'residential', 0,
                        'pitch', 0.85,
                        1],
                    15, ['match', ['get', 'class'],
                        'residential', 0,
                        'pitch', 0.9,
                        1],
                ]

                landuseInsertIndex = i + 1  // insert outline layer after this
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

    // ── Inject pitch outline + glow layers to make football grounds pop ──
    if (landuseInsertIndex >= 0) {
        // Find the source name used by the landuse layer
        const landuseLayer = style.layers[landuseInsertIndex - 1]
        const source = landuseLayer.source || 'composite'
        const sourceLayer = landuseLayer['source-layer'] || 'landuse'

        // Subtle glow behind the pitch
        const pitchGlow = {
            id: 'wc-pitch-glow',
            type: 'fill',
            source,
            'source-layer': sourceLayer,
            filter: ['==', ['get', 'class'], 'pitch'],
            minzoom: 13,
            paint: {
                'fill-color': o.landuse_pitch_outline,
                'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.08, 16, 0.12],
            },
        }

        // Crisp outline in brand red
        const pitchOutline = {
            id: 'wc-pitch-outline',
            type: 'line',
            source,
            'source-layer': sourceLayer,
            filter: ['==', ['get', 'class'], 'pitch'],
            minzoom: 13,
            paint: {
                'line-color': o.landuse_pitch_outline,
                'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 15, 1.5, 18, 2.5],
                'line-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 15, 0.7, 18, 0.85],
            },
        }

        style.layers.splice(landuseInsertIndex, 0, pitchGlow, pitchOutline)
        modified += 2
        console.log(`  ⚽ Injected pitch highlight layers (glow + outline)`)
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
