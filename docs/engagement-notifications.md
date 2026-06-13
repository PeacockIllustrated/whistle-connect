# Re-engagement Notifications

Scheduled "keep using the app" nudges. A single daily cron scans for users in
high-signal segments and sends each at most one nudge, respecting an opt-out and
a frequency cap. This doc is the design + operations reference.

## TL;DR

- **Cron:** `GET /api/cron/engagement`, daily at `0 17 * * *` (UTC) — see `vercel.json`.
- **Auth:** Bearer `CRON_SECRET` (same as every other cron).
- **Kill switch:** `ENGAGEMENT_NUDGES_ENABLED=false` silences it without a redeploy.
- **Transport:** `createNotification(category:'engagement')` → in-app row + web push + FCM.
- **Opt-out:** `profiles.reengagement_opt_out` (toggle on `/app/profile`). Transactional notifications are never affected.
- **Idempotency / cap:** `engagement_nudges` table (migration `0173`).

## Dependency: web push (resolved 2026-06-13)

Re-engagement targets people who have *stopped opening the app*, so it depends on
**OS-level push actually working**. The production VAPID keypair mismatch that
previously stopped every web push from leaving the server is **fixed** (see
CLAUDE.md → Known Issues → Resolved, and the "VAPID Keys" runbook), so nudges now
reach phones as well as the in-app bell. If web push regresses, nudges still
write the in-app row (so they're not lost) but won't buzz — watch Sentry
`push.transport=web` / `push.failure=vapid-*` and `GET /api/admin/push-debug`.
FCM (native) is a separate transport and was never affected by the VAPID issue.

## Segments

Processed highest-value first. A user gets **at most one** nudge per run, and at
most one per `COOLDOWN_DAYS` (3) across all segments.

| `nudge_type` | Who | Trigger | Period | Link |
|---|---|---|---|---|
| `ref_open_matches` | Referee | `is_available`, not age-locked/suspended, **no upcoming confirmed booking**, ≥1 open match within travel radius (`find_bookings_near_referee`) | weekly | `/app/feed` |
| `coach_unfilled` | Coach | Booking `pending`/`offered` (no ref), kickoff within `COACH_UNFILLED_HOURS` (48) | per booking (once) | `/app/bookings/{id}` |
| `ref_payout_setup` | Referee | `is_available` but Stripe Connect not onboarded (`wallets.stripe_connect_onboarded=false`) — can't be paid | monthly | `/app/wallet` |
| `winback` | Any | `last_active_at` older than `DORMANT_DAYS` (21) | weekly | `/app` |

All segments exclude `reengagement_opt_out`, `suspended_at`, and
`setup_complete = false` users.

## How idempotency + frequency capping work

1. At start, the cron reads every `engagement_nudges` row from the last
   `COOLDOWN_DAYS` into an in-memory `inCooldown` set, and keeps a `nudgedThisRun`
   set.
2. Before sending, it **claims** a slot: `INSERT` into `engagement_nudges
   (user_id, nudge_type, period_key)`. The composite PK means a duplicate claim
   raises `23505` → "already nudged this period" → skip. Claim-before-send means
   a re-run or overlapping invocation can never double-send.
3. `period_key` controls the cadence per type: ISO week (`2026-W24`), calendar
   month (`2026-06`), or the booking id (so each unfilled booking nudges once).

Because we claim before sending, a send that fails (e.g. push down) still
consumes the slot — acceptable for nudges, and the in-app row is written first by
`createNotification` regardless of push health, so the nudge still "lands".

## Activity tracking (`last_active_at`)

`src/lib/supabase/middleware.ts` updates `profiles.last_active_at` on `/app`
requests, **throttled to ~hourly** (skips the write if it's been < 1h). Migration
`0173` backfills existing rows to `now()`, so the `winback` segment is empty until
`DORMANT_DAYS` after deploy — no day-one blast to the whole user base.

## Tunables

In `src/app/api/cron/engagement/route.ts`:

| Const | Default | Meaning |
|---|---|---|
| `COOLDOWN_DAYS` | 3 | Min gap between any two nudges to one user |
| `DORMANT_DAYS` | 21 | Win-back threshold |
| `COACH_UNFILLED_HOURS` | 48 | How soon a kickoff must be to nudge the coach |
| `MAX_REFEREES` | 400 | Cap on per-referee `find_bookings_near_referee` fan-out per run |
| `MAX_WINBACK` | 500 | Cap on win-back recipients per run |

## Legal note (PECR / GDPR)

Transactional notifications (bookings, payments, disputes) need no marketing
consent. Re-engagement / win-back nudges **are** marketing: keep them opt-out-able
(`reengagement_opt_out`) and honoured everywhere. The opt-out is enforced both at
candidate selection (cron) and as a backstop in `createNotification`.

## Verifying

```bash
# Dry trigger (counts are zero until data + last_active_at age in)
curl -H "Authorization: Bearer $CRON_SECRET" https://www.whistleconnect.co.uk/api/cron/engagement
# → { success: true, ref_open_matches, coach_unfilled, ref_payout_setup, winback, errors: [] }
```

Filter Sentry on tag `route=cron-engagement` for batch errors and
`engagement.step=claim` for dedupe-insert anomalies.
