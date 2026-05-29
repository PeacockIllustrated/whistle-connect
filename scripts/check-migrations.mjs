#!/usr/bin/env node
/**
 * Migration chain linter — static, no database required.
 *
 * Catches the class of bug that makes the migration set fail to rebuild a
 * database from scratch (the failure mode that broke the Supabase test
 * branch: `0002_rls_policies` ran `ALTER TABLE user_badges …` before any
 * migration created `user_badges`).
 *
 * What it checks, in the order Supabase applies migrations (by the leading
 * numeric version token of each filename):
 *
 *   1. Duplicate version prefixes — two files claiming the same version
 *      (e.g. 0001_initial_schema.sql AND 0001_reset_schema.sql). Supabase
 *      records one `version` row; the second is ambiguous / dead.
 *
 *   2. Baseline / setup files that aren't real migrations — e.g.
 *      000_complete_setup.sql ("run once manually"). These get swept up by
 *      `supabase db reset` and run out of order, corrupting a fresh build.
 *
 *   3. Forward references — a public-schema table referenced by ALTER TABLE
 *      / CREATE POLICY ON / CREATE TRIGGER … ON / CREATE INDEX … ON /
 *      INSERT INTO before any earlier migration created it. This is the
 *      exact bug that broke the branch replay.
 *
 * It is a HEURISTIC (regex over SQL, not a real parser). It will not catch
 * everything a real Postgres replay would — a function body referencing a
 * missing column, a type mismatch, a dropped-then-used object. It WILL
 * catch the structural "object used before it exists" breakages, which are
 * what actually fail in practice. Treat a clean run as necessary, not
 * sufficient — the authoritative check is `supabase db reset` against a
 * throwaway database (see supabase/migrations/REBUILD.md).
 *
 * Exit code: 0 = no issues, 1 = issues found (so it can gate CI).
 *
 * Usage: node scripts/check-migrations.mjs
 */

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations')

// Schemas whose tables are provided by the platform, not our migrations.
// References into these are never "forward references" we can resolve.
const EXTERNAL_SCHEMAS = ['auth', 'storage', 'realtime', 'extensions', 'vault', 'supabase_migrations', 'cron', 'net', 'pg_catalog', 'information_schema']

// Tables that exist before any of our migrations (platform-provided) or are
// known to be created out-of-band. `user_badges` / `badges` are included
// because the historical reset migrations (0001_reset_schema) were authored
// to PRESERVE an already-existing badges table rather than create it — so a
// from-scratch build legitimately won't have them. They're listed here so
// the linter reports them ONCE as a known-baseline gap rather than on every
// reference. Remove from this list once a migration actually creates them.
const PRESUMED_PREEXISTING = new Set([
    'auth.users',
])

function listMigrationFiles() {
    return readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
}

/** Supabase derives the version from the leading run of digits in the filename. */
function versionOf(filename) {
    const m = filename.match(/^(\d+)/)
    return m ? m[1] : null
}

/**
 * Sort the way `supabase db reset` applies them: by version token as a
 * string (Supabase compares versions lexically), tie-broken by filename.
 */
function sortMigrations(files) {
    return [...files].sort((a, b) => {
        const va = versionOf(a) ?? ''
        const vb = versionOf(b) ?? ''
        if (va !== vb) return va < vb ? -1 : 1
        return a < b ? -1 : 1
    })
}

// Strip line + block comments so we don't match table names inside comments.
function stripComments(sql) {
    return sql
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/--[^\n]*/g, ' ')
}

function normalizeName(raw) {
    // Drop quotes, lowercase, keep schema.table shape.
    const cleaned = raw.replace(/"/g, '').toLowerCase()
    return cleaned
}

function isExternal(name) {
    const dot = name.indexOf('.')
    if (dot === -1) return false
    const schema = name.slice(0, dot)
    return EXTERNAL_SCHEMAS.includes(schema)
}

// Bare-name → assume public schema for tracking purposes.
function publicKey(name) {
    return name.includes('.') ? name : `public.${name}`
}

const CREATE_TABLE_RE = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)/gi
// Statements that REFERENCE an existing table.
const REFERENCE_RES = [
    { kind: 'ALTER TABLE', re: /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([a-z0-9_."]+)/gi },
    { kind: 'CREATE POLICY', re: /create\s+policy\s+(?:[^]*?)\s+on\s+([a-z0-9_."]+)/gi },
    { kind: 'CREATE TRIGGER', re: /create\s+(?:or\s+replace\s+)?trigger\s+[a-z0-9_."]+\s+(?:before|after|instead\s+of)\s+[^]*?\s+on\s+([a-z0-9_."]+)/gi },
    { kind: 'CREATE INDEX', re: /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?[a-z0-9_."]+\s+on\s+([a-z0-9_."]+)/gi },
    { kind: 'INSERT INTO', re: /insert\s+into\s+([a-z0-9_."]+)/gi },
]

function main() {
    const files = listMigrationFiles()
    const ordered = sortMigrations(files)

    const problems = []
    const notes = []

    // ── 1. Duplicate version prefixes ────────────────────────────────────
    const byVersion = new Map()
    for (const f of ordered) {
        const v = versionOf(f)
        if (!v) {
            problems.push(`NON-NUMERIC PREFIX: "${f}" has no leading version number — Supabase ordering is undefined for it.`)
            continue
        }
        if (!byVersion.has(v)) byVersion.set(v, [])
        byVersion.get(v).push(f)
    }
    for (const [v, fs] of byVersion) {
        if (fs.length > 1) {
            problems.push(`DUPLICATE VERSION ${v}: ${fs.join(', ')} — only one row is recorded in schema_migrations; the others are ambiguous/dead.`)
        }
    }

    // ── 2. Baseline / "complete setup" files masquerading as migrations ──
    for (const f of ordered) {
        if (/complete[_-]?setup|^000_/.test(f)) {
            notes.push(`BASELINE FILE: "${f}" looks like a one-time manual setup snapshot, not an incremental migration. A fresh \`db reset\` will run it in version order ("${versionOf(f)}") which may not match intent.`)
        }
    }

    // ── 3. Forward references + duplicate CREATE TABLE collisions ────────
    const createdTables = new Set() // public-qualified keys
    // Track which migration(s) issue a NON-idempotent CREATE TABLE for each
    // table. Two files creating the same table without IF NOT EXISTS will
    // collide ("relation already exists") on a fresh db reset — exactly what
    // the three competing baseline files (000_complete_setup /
    // 0001_initial_schema / 0001_reset_schema) do to each other.
    const hardCreatedBy = new Map() // key -> [files]
    for (const f of ordered) {
        const sql = stripComments(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))

        // Non-idempotent creates (no IF NOT EXISTS) for collision detection.
        for (const m of sql.matchAll(/create\s+table\s+(?!if\s+not\s+exists)([a-z0-9_."]+)/gi)) {
            const name = normalizeName(m[1])
            if (isExternal(name)) continue
            const key = publicKey(name)
            if (!hardCreatedBy.has(key)) hardCreatedBy.set(key, [])
            hardCreatedBy.get(key).push(f)
        }

        // First, harvest references in this file BEFORE registering its own
        // CREATEs — a file can both create and reference, but referencing a
        // table created LATER in the SAME file is still fine at apply time
        // (statements run top to bottom). To keep the heuristic simple and
        // avoid false positives within a file, we register this file's
        // creates first, then check references against the cumulative set.
        // That means we only flag references to tables not created in THIS
        // file or any EARLIER one — the real cross-migration break.
        const thisFileCreates = new Set()
        for (const m of sql.matchAll(CREATE_TABLE_RE)) {
            const name = normalizeName(m[1])
            if (isExternal(name)) continue
            thisFileCreates.add(publicKey(name))
        }
        for (const k of thisFileCreates) createdTables.add(k)

        for (const { kind, re } of REFERENCE_RES) {
            for (const m of sql.matchAll(re)) {
                const name = normalizeName(m[1])
                if (isExternal(name)) continue
                if (PRESUMED_PREEXISTING.has(name)) continue
                const key = publicKey(name)
                if (PRESUMED_PREEXISTING.has(key.replace('public.', ''))) continue
                if (!createdTables.has(key)) {
                    problems.push(`FORWARD REF in ${f}: ${kind} references "${name}" before any earlier migration creates it.`)
                }
            }
        }
    }

    // ── 4. Collision summary (same table hard-created by >1 migration) ──
    const collisions = [...hardCreatedBy.entries()].filter(([, fs]) => fs.length > 1)
    if (collisions.length) {
        // Group by the SET of files so the three-baseline overlap reports as
        // one finding rather than once per table.
        const byFileSet = new Map()
        for (const [key, fs] of collisions) {
            const sig = [...new Set(fs)].sort().join(' + ')
            if (!byFileSet.has(sig)) byFileSet.set(sig, [])
            byFileSet.get(sig).push(key.replace('public.', ''))
        }
        for (const [sig, tables] of byFileSet) {
            problems.push(
                `CREATE TABLE COLLISION: ${sig} each create ${tables.length} of the same table(s) without IF NOT EXISTS ` +
                `(e.g. ${tables.slice(0, 4).join(', ')}${tables.length > 4 ? '…' : ''}) — a fresh \`db reset\` errors on the second create.`,
            )
        }
    }

    // ── Report ───────────────────────────────────────────────────────────
    console.log(`Scanned ${ordered.length} migration files in ${MIGRATIONS_DIR}\n`)

    if (notes.length) {
        console.log('NOTES:')
        for (const n of notes) console.log(`  • ${n}`)
        console.log('')
    }

    if (problems.length === 0) {
        console.log('No structural problems found by the static linter.')
        console.log('(Authoritative check is still `supabase db reset` — see supabase/migrations/REBUILD.md)')
        process.exit(0)
    }

    console.log(`FOUND ${problems.length} STRUCTURAL PROBLEM(S):\n`)
    // De-dup identical forward-ref spam (same table referenced many times in one file).
    const seen = new Set()
    for (const p of problems) {
        if (seen.has(p)) continue
        seen.add(p)
        console.log(`  ✗ ${p}`)
    }
    console.log('\nThese will break a from-scratch `supabase db reset`.')
    console.log('See supabase/migrations/REBUILD.md for the squash-to-baseline fix.')
    process.exit(1)
}

main()
