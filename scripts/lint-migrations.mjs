#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Migration lint (premortem WS-F).
//
// Prevents the regression class that migration 0155 had to clean up: a later
// `CREATE OR REPLACE FUNCTION ... SECURITY DEFINER` that silently dropped the
// `SET search_path` pin and/or re-exposed EXECUTE to anon/PUBLIC (0150, 0151,
// 0144 each did this). Postgres resets per-function config and re-grants
// default PUBLIC EXECUTE on every CREATE OR REPLACE, so every migration that
// (re)defines a SECURITY DEFINER function must, IN THE SAME FILE, both:
//   1. pin the search_path  (SET search_path = ...)
//   2. revoke EXECUTE from anon / PUBLIC  (REVOKE EXECUTE ... FROM ... anon|public)
//
// Historical non-compliant files are grandfathered via a baseline so CI is
// green today; any NEW violation fails. To re-seed the baseline (e.g. after a
// deliberate, reviewed exception): `node scripts/lint-migrations.mjs --update-baseline`.
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(here, '..', 'supabase', 'migrations')
const BASELINE_PATH = join(here, 'migration-lint-baseline.json')

function definesSecurityDefinerFunction(sql) {
    const lower = sql.toLowerCase()
    return /create\s+(or\s+replace\s+)?function/.test(lower) && /security\s+definer/.test(lower)
}

function pinsSearchPath(sql) {
    return /set\s+search_path/i.test(sql)
}

// Look for a REVOKE statement (up to its terminating `;`) that takes EXECUTE
// away from anon or PUBLIC. Splitting on `;` keeps multi-line REVOKEs intact
// and avoids matching an unrelated `anon`/`public` elsewhere in the file.
function revokesFromAnonOrPublic(sql) {
    return sql.split(';').some((stmt) => {
        const t = stmt.toLowerCase()
        return /\brevoke\b/.test(t) && /\bfrom\b/.test(t) && /\b(anon|public)\b/.test(t)
    })
}

function findViolations() {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
    const violations = []
    for (const file of files) {
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
        if (!definesSecurityDefinerFunction(sql)) continue
        const problems = []
        if (!pinsSearchPath(sql)) problems.push('missing SET search_path')
        if (!revokesFromAnonOrPublic(sql)) problems.push('missing REVOKE EXECUTE ... FROM anon/PUBLIC')
        if (problems.length) violations.push({ file, problems })
    }
    return { files, violations }
}

const { files, violations } = findViolations()

if (process.argv.includes('--update-baseline')) {
    writeFileSync(BASELINE_PATH, JSON.stringify(violations.map((v) => v.file).sort(), null, 2) + '\n')
    console.log(`Baseline updated: ${violations.length} grandfathered file(s) of ${files.length} scanned.`)
    process.exit(0)
}

const baseline = existsSync(BASELINE_PATH)
    ? new Set(JSON.parse(readFileSync(BASELINE_PATH, 'utf8')))
    : new Set()

const newViolations = violations.filter((v) => !baseline.has(v.file))

if (newViolations.length > 0) {
    console.error('Migration lint FAILED.')
    console.error('A SECURITY DEFINER function must pin search_path AND revoke EXECUTE from anon/PUBLIC in the same migration file:\n')
    for (const v of newViolations) console.error(`  - ${v.file}: ${v.problems.join('; ')}`)
    console.error('\nFix the migration, or (for a reviewed exception) re-seed the baseline:')
    console.error('  node scripts/lint-migrations.mjs --update-baseline')
    process.exit(1)
}

console.log(`Migration lint passed: ${files.length} files scanned, ${violations.length} grandfathered, 0 new violations.`)
