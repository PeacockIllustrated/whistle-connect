# Migrations: numbering, drift, and the CI guard

This repo's migration history is **not** a clean 1:1 with the remote tracking
table. This file records the reality so a future change (a rollback, a fresh
`supabase db reset`, a new environment, or a second developer) doesn't trip
over it. Background: the premortem flagged migration drift (card 8); this is the
reconciliation note.

## The two numbering schemes

- **Repo filenames** use `0xxx_name.sql` (e.g. `0162_money_rpc_stop_bleed.sql`).
- **Remote tracking** (`supabase_migrations.schema_migrations`, surfaced by the
  Supabase MCP `list_migrations`) uses a mix of **legacy `0xxx`** versions
  (pre-reset: `0001`–`0109`, plus a legacy `0159 tournament_opt_in`) and
  **post-reset timestamped** versions (`20260429111111`, …). Supabase migration
  tracking was reset at some point, which is why the schemes diverge.

So the filename number is **not** the tracked version for anything after the
reset. Approximate mapping for the recent, timestamped entries:

| Repo file | Remote tracked version | Name |
|---|---|---|
| 0138 | 20260429111111 | security_advisor_sweep |
| 0140 | 20260429140858 | restore_rls_helper_grants |
| 0142 | 20260429173957 | webhook_events_log |
| 0143 | 20260429174034 | atomic_withdraw |
| 0144 | 20260430105247 | dual_completion_confirmation |
| 0145 | 20260430124743 | dispute_structured_fields |
| 0146 | 20260430133457 | default_referees_available |
| 0148 | 20260501090833 | 0148_wallet_descriptions_breakdown |
| 0149 | 20260501092332 | 0149_per_user_booking_archive |
| 0150 | 20260504013225 | confirm_booking_accepts_price |
| 0151 | 20260504103525 | offer_per_user_archive |
| 0152 | 20260507060541 | thread_participant_archive |
| 0153 | 20260507063949 | add_tournament_booking_type |
| 0154 | 20260507071938 / …085003 | sos_premium_fee (+ use_booking_reftype) |
| 0155 | 20260604112413 | 0155_security_advisor_resweep |
| 0158 | 20260604112439 | 0158_account_deletion |
| 0159 | 20260604112514 | 0159_moderation_reports_blocks |
| 0160 | 20260604113445 | 0160_user_suspension |

## Known collisions / orphans (do not reuse these numbers)

- **Two `0001`**: `0001_initial_schema.sql` and `0001_reset_schema.sql`.
- **`000_complete_setup.sql`**: a pre-`0001` full-setup file. Left in place —
  removing it risks breaking a fresh `db reset` baseline; verify before deleting.
- **Two `0160`**: `0160_user_suspension.sql` and `0160_referee_tournament_opt_in.sql`.
- **`0159` clash**: repo `0159_moderation_reports_blocks.sql` vs a **legacy
  remote** `0159 tournament_opt_in` (different thing, pre-reset). Never reuse 0159.

## Out-of-band / untracked

- **`0156_referee_dob_and_parental_consent.sql`** and
  **`0157_tournament_matches.sql`**: their objects (`parental_consents`,
  `tournament_matches`, the DOB-aware `handle_new_user`) **exist in prod** but
  do **not** appear in remote tracking by name — they were applied out-of-band.
  A fresh `db reset` from the repo *will* recreate them (the SQL is here), but
  the remote tracking table doesn't list them.
- **`0147_truncate_web_push_subscriptions.sql`**: only run when rotating VAPID
  keys; not part of the normal schema.

### Reconciliation SQL (run with approval; prod-read/write is guarded)

To make the remote tracking table agree that 0156/0157 are applied (so tooling
that diffs repo↔remote stops flagging them), insert their version rows
idempotently. **Confirm the managed deploy flow accepts manual tracking inserts
first** (via `list_migrations`); if not, treat this as documentation only:

```sql
insert into supabase_migrations.schema_migrations (version, name)
values
  ('0156', 'referee_dob_and_parental_consent'),
  ('0157', 'tournament_matches')
on conflict (version) do nothing;
```

## Going forward (enforced by CI)

`npm run lint:migrations` (`scripts/lint-migrations.mjs`, run in
`.github/workflows/ci.yml`) **fails any new migration** that defines a
`SECURITY DEFINER` function without, in the same file, both:

1. `SET search_path = public, pg_temp`, and
2. `REVOKE EXECUTE ... FROM anon, PUBLIC`.

This is the exact regression class `0155` had to clean up (later
`CREATE OR REPLACE` in `0150`/`0151`/`0144` silently dropped both). Historical
non-compliant files are grandfathered in `scripts/migration-lint-baseline.json`;
to add a reviewed exception, run `node scripts/lint-migrations.mjs --update-baseline`.

**Rules:** use the next free `0xxx` number; never reuse one; every SECDEF
`CREATE OR REPLACE` re-pins search_path and re-revokes anon/PUBLIC.
