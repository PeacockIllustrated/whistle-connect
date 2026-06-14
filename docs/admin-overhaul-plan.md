# Admin Overhaul + Analytics + Autonomous FA Confirmation — Plan

> Status: **PLAN ONLY** (no implementation yet). Decisions locked 2026-06-13.
> Scope: a "next goal" to give admins a proper overview of the app, surface
> analytics in-app, and make FA registration confirmation autonomous.

## Locked decisions

| Decision | Choice |
|---|---|
| FA register matching aggressiveness | **Staged one-click approve** — import flags matches; an admin approves (single click, batchable). A config flag can flip to fully autonomous later. |
| Analytics source | **First-party events in Supabase** for the admin's operational/product metrics; **keep GA consent-gated** for marketing/acquisition. Optional GA4 Data API "Acquisition" tab is a later nice-to-have. |
| Rollout | Plan doc first (this). Then implement in milestone order below. |

## Open input still needed

- **A sample of the FA's FAN register sheet** — its actual column headers and one
  dummy row. This decides the matching keys and whether we can also auto-sync
  DBS / safeguarding expiry / qualification level. Everything in Workstream C
  below assumes at least `FAN`, `name`, `county`; the bonus sync assumes the
  expiry/level columns exist.

---

## Current state (from code recon, 2026-06-13)

The admin area is already substantial — this is an **overhaul, not a rebuild**.

**Exists today**
- Admin overview at `/app` (`AdminDashboard`): `AdminTriagePanel` (FA backlog by
  county, open disputes, stuck escrow, failed withdrawals, expiring DBS, webhook
  failures 24h, minors awaiting consent) + `DashboardStats` (12 stat cards) +
  quick-action cards + coach/referee preview tabs.
- Pages under `src/app/app/admin/`: `referees`, `referees/[id]`, `coaches`,
  `verification` (FA queue), `safeguarding`, `map` (Mapbox), `reports`
  (moderation), `settings`, `audit`, `triage/{escrow,withdrawals,webhooks}`.
- `requireAdmin()` in `src/app/app/admin/actions.ts` (+ duplicated inline guards
  on each page). Admin actions log to `admin_audit_log` via
  `src/lib/admin/audit.ts` `logAdminAction()`.
- Admin API: `broadcast-push`, `push-debug`, `health`, `send-fa-verification`,
  `backfill-geo`, `wc-seed` (all Bearer `CRON_SECRET`, except the two FA/geo ones
  which check an admin cookie session).

**Gaps**
- **No charting library**; every metric is **point-in-time** (no trends/history).
- **No analytics surfaced in-app** (GA is consent-gated and unreadable client-side).
- **FA confirmation is manual** per-referee email round-trips (county FA replies).
- **No spreadsheet parser** in the repo.
- Admin nav is scattered across cards + a 2-item bottom-nav; `requireAdmin` is
  duplicated rather than enforced once at a layout.

---

## Workstream A — Admin dashboard overhaul

**Goal:** one coherent admin shell with at-a-glance health + trends.

- **A1 — Admin shell.** `src/app/app/admin/layout.tsx` with a sidebar/tab nav
  consolidating the scattered links; hoist `requireAdmin` to the layout and
  collapse the per-page inline guards to a shared helper. Keeps admins off the
  cramped bottom-nav.
- **A2 — Overview + trends.** Promote `AdminDashboard` into `/app/admin`. Add
  time-series with **recharts**:
  - signups by role, bookings created, bookings by status, **fill rate**
    (% bookings that got a referee), GMV (escrow released), disputes opened,
    SOS volume — over selectable 7/30/90-day windows.
  - Powered by a `getAdminOverview` aggregator (extends the existing
    `getAdminTriage` `Promise.all` pattern) using `date_trunc('day', created_at)`
    GROUP BY over existing timestamp columns. **No new write path** for v1;
    move to a nightly rollup table only if these reads get slow.
- **A3 — Health strip.** Render `/api/admin/health` booleans (Stripe / VAPID /
  Make / cron / service-role) + the `push-debug` public-key fingerprint as a
  visible status row — turns curl-only diagnostics into something glanceable.
- **A4 — Money panel.** Escrow held, released this week, platform fees collected,
  pending withdrawals, from `wallets` / `wallet_transactions`.

**New deps:** `recharts` (React 19 compatible, lightweight).

---

## Workstream B — Analytics piping (first-party)

**Goal:** the operational/product numbers the admin needs, in-app, without GA's
consent blind spot.

- **B1 — `analytics_events` table.** Lightweight append-only log:
  `(id, event text, user_id uuid null, role text null, props jsonb, created_at)`.
  RLS deny-all; written only via service-role/server. Index on
  `(event, created_at)` and `(created_at)`.
- **B2 — Emit events server-side** at the moments that matter:
  `signup`, `booking_created`, `offer_sent`, `booking_confirmed`,
  `escrow_released`, `sos_posted`, `session_active` (reuse the
  `profiles.last_active_at` heartbeat already added in migration 0173 rather than
  a per-request write). A thin `track(event, {...})` helper mirroring
  `logAdminAction`.
- **B3 — Aggregate into Workstream A** charts (funnels: created → offered →
  confirmed → completed; active users; cohort by role/county). Most of A's
  trends come "free" from existing rows; B fills the gaps (active users, funnel
  drop-off) that aren't already first-class tables.

**Privacy:** first-party aggregate operational analytics is legitimate-interest
and sets **no new cookie**, so it sidesteps GA's consent-gating for the metrics
the business needs. **GA stays consent-gated** for marketing. Note the
first-party processing in the privacy policy.

**Deferred (B-optional):** a read-only "Acquisition" tab via the **GA4 Data API**
(`google-analytics-data` `runReport`, GCP service account with Viewer on the
property, cached ~1h) to surface sessions / sources / geography. Adds a Google
secret + quota; only worth it if marketing wants GA numbers inside the admin.

---

## Workstream C — Autonomous FA (FAN) confirmation

**Goal:** replace per-referee county-FA email round-trips with bulk ingestion of
the FA's official register; **staged** auto-confirmation of matches.

Current flow (recon): admin clicks "Verify with County FA" →
`createFAVerificationRequest` writes a `fa_verification_requests` row + a
`response_token` (14-day TTL, migration 0171) → email via Make→Zoho to the
`county_fa_contacts` address → county FA opens read-only `/fa-verify/confirm` →
POST `/api/fa-verify` flips `referee_profiles.fa_verification_status`
verified/rejected. Slow; depends on each county FA replying.

Proposed:

- **C1 — Parser.** Add `xlsx` (SheetJS) — handles `.xlsx` and CSV. Parse
  server-side only.
- **C2 — Upload.** Admin page `src/app/app/admin/fa-register/` →
  `POST /api/admin/fa-register/import`, guarded by **`requireAdmin` cookie
  session** (interactive, not `CRON_SECRET`). Archive the raw file to a **private
  Supabase Storage bucket** (`fa-registers/`) for audit (pattern mirrors
  `AvatarUpload`).
- **C3 — Reference table** `fa_register_entries`:
  `(fan text primary key, full_name text, county text, qualification_level text
   null, dbs_expiry date null, safeguarding_expiry date null, source_file text,
   imported_at timestamptz, imported_by uuid)`. Upsert on `fan`. RLS deny-all
  (admin/service-role only). This is the FA's snapshot of truth.
- **C4 — Matching engine** (after import): join `referee_profiles.fa_id`
  (UNIQUE, regex `^\d{8,10}$`) to `fa_register_entries.fan`.
  - Exact FAN match **+ name-similarity sanity check** → **staged candidate**.
  - Surface in the FA verification queue: *"N referees match the latest register
    → Review / Approve all"*. Admin one-click approval sets
    `fa_verification_status='verified'`, closes open `fa_verification_requests`,
    notifies the referee, and writes `admin_audit_log` (`fa.register.match`) with
    the **source file + row** for provenance.
  - FAN present but **name materially different** → flag, never auto-approve.
  - Referee FAN **absent** from register → flag *"not in latest register"* for
    review; the county-FA email flow remains the fallback.
  - Config flag `FA_REGISTER_AUTOCONFIRM` (default off) to later flip from staged
    to fully autonomous without code changes.
- **C5 — Bonus sync** (only if the sheet carries them): DBS / safeguarding
  expiry + qualification level → keeps the DBS-expiry triage accurate
  automatically, behind the same staged-approval gate.
- **C6 — Keep** the county-FA email flow as the fallback for referees not in a
  register export (new signups between FA exports).

**Safeguarding guardrail (hard rule):** FAN ingestion may only ever touch
`fa_verification_status` (+ optionally DBS/level). It must **never** touch
`parental_consent_status`, the minor lock, or suspension — minor safeguarding
stays human-reviewed. (Mirrors the existing `verifyReferee` boundary, which
atomically promotes FA/DBS/safeguarding but is explicitly separate from consent.)

---

## Milestones (sequencing)

1. **M1 — Admin shell + overview charts** (Workstream A). Highest daily value,
   lowest risk, no new secrets. Deps: `recharts`.
2. **M2 — First-party events** (Workstream B1–B3) to power funnel / active-user
   metrics A can't derive from existing rows.
3. **M3 — FAN ingestion** (Workstream C). High operational value for the FA
   trial. Deps: `xlsx`, a Storage bucket, one migration (`fa_register_entries`),
   one admin upload route + page. **Blocked on the FAN sample.**
4. **M4 — (optional) GA4 Data API Acquisition tab** (Workstream B-optional).

## Risks / notes

- Migration numbering continues from `0173`; any new SECDEF function must pin
  `search_path` + revoke `anon`/`PUBLIC` (CI guard `npm run lint:migrations`).
- `fa_register_entries` and `analytics_events` follow the `0172`/`0166` posture:
  RLS on, no policies, service-role only.
- Charts read aggregates behind `requireAdmin`; never expose per-user analytics
  to non-admins.
- Make→Zoho remains the sole email transport; FAN ingestion reduces reliance on
  it for verification (fewer county-FA emails) but doesn't remove the dependency.
- Keep these three workstreams isolated from booking/escrow/money paths.
