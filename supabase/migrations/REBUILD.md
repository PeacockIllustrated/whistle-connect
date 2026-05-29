# Migration chain — rebuild & squash runbook

> TL;DR — **Production is healthy.** This document is about making a database
> rebuildable *from scratch* (CI, a fresh Supabase branch, a new environment).
> Today that is broken. The fix is a one-time squash-to-baseline, which needs
> either Docker or the production DB password — see "The fix" below.

## Current state (verified 2026-05-29 against prod `tszyfzctjxlopvsvbinj`)

- The **live production schema is complete and correct** — every migration up
  to and including `0159_tournament_opt_in` is present (`tournament_opt_in`,
  the `checkin_*` columns + `checkin-evidence` bucket, `tournament_matches`,
  `date_of_birth` + `parental_consents`, etc. all confirmed present).
- `supabase_migrations.schema_migrations` has **35 tracked rows**. Production
  was built up incrementally over many months, partly via the migration system
  and partly via dashboard SQL, so the tracked history is a faithful record of
  *what ran on prod* — but it is **not** a clean, replayable sequence.
- **Nothing here is a production risk.** Do not "repair" prod's migration
  history to fix the items below unless you are deliberately doing the squash.

## The problem — why a from-scratch build fails

Run the static linter to see it without a database:

```bash
npm run lint:migrations
```

It reports (as of this writing):

1. **Three competing "baseline" files** all claim the front of the chain and
   each hard-`CREATE TABLE` the same ~10 core tables:
   - `000_complete_setup.sql` — the real one-time manual genesis (12 tables
     incl. `badges` + `user_badges`). Version token `000`. **Never tracked**
     as a migration — it was pasted into the SQL editor once.
   - `0001_initial_schema.sql` — 10 tables, no `user_badges`. This is what
     prod's tracked `version = '0001'` actually contains, so it's what a
     Supabase **branch** replays.
   - `0001_reset_schema.sql` — 11 tables, recreates `user_badges`, *preserves*
     an already-existing `badges`. A competing **duplicate version `0001`**.

2. Because all three hard-create `profiles`, `clubs`, … without
   `IF NOT EXISTS`, a fresh `supabase db reset` (which runs every `.sql` in
   version order) errors on the second `CREATE TABLE profiles`.

3. The Supabase **branch** failure we actually hit
   (`relation "user_badges" does not exist` in `0002_rls_policies`) is the
   *tracked-history* version of the same mess: tracked `0001` =
   `0001_initial_schema` (no `user_badges`), then `0002` adds RLS to
   `user_badges`, which was only ever created by `000_complete_setup` /
   `0001_reset_schema` — neither of which is in the tracked history.

There is also general drift: many later migrations were authored as
`CREATE OR REPLACE` / `ADD COLUMN IF NOT EXISTS` patches applied directly in
the dashboard, so the file set and the tracked history are not 1:1.

## The fix — squash to a single baseline

This is the standard remedy for "prod is fine but the history is un-replayable".
It needs **Docker** (for `supabase db reset` validation) or the **production
DB password** (for `supabase db dump`). Neither is available in the agent
environment that diagnosed this, which is why it hasn't been executed yet.

### Prerequisites
- `supabase` CLI logged in (`supabase login`) — already done on this machine.
- Either Docker Desktop running, **or** the prod DB password to hand.

### Steps

1. **Dump the current production schema** as the new baseline:
   ```bash
   supabase link --project-ref tszyfzctjxlopvsvbinj
   supabase db dump --linked -f supabase/migrations/00000000000000_baseline.sql
   #  (schema only; add --data-only separately if any seed/reference data is needed)
   ```
   This file is, by construction, a faithful and internally-consistent
   snapshot of the working production schema.

2. **Archive the old chain** so it stops being replayed but stays in git
   history for reference:
   ```bash
   mkdir -p supabase/migrations/_archive_pre_baseline
   git mv supabase/migrations/000_complete_setup.sql \
          supabase/migrations/0001_initial_schema.sql \
          supabase/migrations/0001_reset_schema.sql \
          supabase/migrations/0002_*.sql ... \
          supabase/migrations/0159_tournament_opt_in.sql \
          supabase/migrations/_archive_pre_baseline/
   ```
   (Everything `0xxx` through `0159` moves; the baseline replaces them.)

3. **Validate the baseline rebuilds from zero** (this is the authoritative
   check the linter can't do):
   ```bash
   supabase db reset            # spins up a local DB, applies ONLY the baseline
   npm run lint:migrations      # should now be clean
   ```
   Fix any errors in the baseline until `db reset` is green.

4. **Adopt the baseline on production without re-running it** — prod already
   has this schema, so you only update the tracked history, you do NOT execute
   the baseline against prod:
   ```bash
   supabase migration repair --status reverted <every-old-version>   # optional tidy
   supabase migration repair --status applied 00000000000000          # mark baseline applied
   ```
   Verify with `supabase migration list` that prod shows the baseline as
   applied and nothing pending.

5. **New migrations** from here are normal incremental files on top of the
   baseline (`supabase migration new <name>`), and `npm run lint:migrations`
   + `supabase db reset` gate every PR.

### Safety notes
- The squash **must not** run the baseline DDL against production — step 4 only
  rewrites the bookkeeping table. Getting this wrong (re-running `CREATE TABLE`
  on prod) is the one genuinely dangerous misstep; `migration repair` is the
  correct, non-destructive tool.
- Do the squash **after the FA trial**, not during. It touches migration
  bookkeeping and deserves a calm window with a verified backup, not a
  pre-trial scramble. Until then, prod is fine and the linter prevents new
  baseline-style breakage from creeping in.

## Why not just edit the old files in place?

The old migrations have already run on production. Editing an applied migration
doesn't change prod (it won't re-run) and corrupts the audit trail — the file
would no longer describe what actually happened. Squash-to-baseline is the
disciplined fix; in-place edits are not.

## Guardrail

`npm run lint:migrations` (`scripts/check-migrations.mjs`) is a static check —
no DB required. It catches duplicate version prefixes, stray baseline/setup
files, cross-migration `CREATE TABLE` collisions, and forward references
(an object used before any earlier migration creates it). Wire it into CI so
the chain can't regress. It is necessary-but-not-sufficient: the authoritative
check remains `supabase db reset` against a throwaway database.
