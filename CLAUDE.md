# Whistle Connect - AI Development Guide

## Project Overview

**Whistle Connect** is a grassroots football operations app that streamlines referee bookings and match communications. It connects coaches who need referees with qualified officials who are available.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1.1 (App Router) |
| UI | React 19.2.3, Tailwind CSS 4 |
| Language | TypeScript 5 (strict mode) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Real-time | Supabase Realtime |
| Storage | Supabase Storage (avatars) |
| Notifications | Web Push (VAPID) + FCM (firebase-admin) — dual transport, in-app row always |
| Payments | Stripe Checkout (top-ups), Stripe Connect Express (referee payouts), Stripe Transfers |
| Observability | Sentry (`@sentry/nextjs`) — server + edge + client init, source maps via `withSentryConfig` |
| Cron | Vercel Cron — `vercel.json` schedules `*/15 * * * *` escrow-release + weekly reconcile |
| Deployment | Vercel (custom domain `www.whistleconnect.co.uk`) |

### Core Business Logic

**User Roles**: `coach` | `referee` | `admin`

**Booking Workflow**:
```
draft → pending → offered → confirmed → completed
                     ↓
                 cancelled
```

**Offer Workflow**:
```
sent → accepted_priced → accepted
  ↓         ↓
declined  withdrawn
```

**Mutual Confirmation Gate (Phase 2 payments)**:

Once both parties mark complete, escrow releases on the next cron tick. If only one party marks, escrow auto-releases at kickoff + 48h. The cron at `/api/cron/escrow-release` runs both paths every 15 minutes.

```
confirmed → coach_marked_complete_at + referee_marked_complete_at
              ↓ (both set)
         both_confirmed_at + status='completed'
              ↓ (next cron tick)
         escrow_released_at set, ref wallet credited
```

Edge case: kickoff + 48h with neither party confirming → fallback release path. Open dispute blocks both paths.

**Dispute window**: any time after `confirmed` until `escrow_released_at` is set. Structured form (category + desired_outcome + 50-char-min reason + optional incident timestamp) — no more `prompt()`.

---

## Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── auth/                     # Login, registration pages
│   ├── app/                      # Protected routes (requires auth)
│   │   ├── admin/                # Admin: referee verification
│   │   ├── availability/         # Referee availability management
│   │   ├── bookings/             # Booking CRUD and workflow
│   │   │   ├── actions.ts        # Server actions for bookings
│   │   │   └── [id]/             # Individual booking pages
│   │   ├── messages/             # Messaging threads
│   │   ├── offers/               # Referee offer inbox
│   │   └── profile/              # User profile management
│   ├── book/                     # Public booking pages
│   └── layout.tsx                # Root layout with ThemeProvider
├── components/
│   ├── app/                      # Feature-specific components
│   ├── profile/                  # Profile-related components
│   └── ui/                       # Reusable UI primitives
├── lib/
│   ├── auth/actions.ts           # Auth server actions
│   ├── supabase/                 # Supabase client setup
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client
│   │   └── middleware.ts         # Session refresh
│   ├── notifications.ts          # Push notification handling
│   ├── types.ts                  # TypeScript type definitions
│   └── utils.ts                  # Utility functions
└── middleware.ts                 # Auth route protection

supabase/
├── migrations/                   # Database migrations (ordered)
├── config.toml                   # Supabase project config
└── emails/                       # Email templates
```

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (linked to auth.users) |
| `referee_profiles` | Extended referee data (level, county, DBS status) |
| `referee_availability` | Recurring weekly availability slots |
| `referee_date_availability` | Date-specific availability overrides |
| `bookings` | Match booking records |
| `booking_offers` | Offers sent from coaches to referees |
| `booking_assignments` | Confirmed referee assignments |
| `threads` | Message thread containers |
| `thread_participants` | Thread membership tracking |
| `messages` | Individual messages |
| `notifications` | In-app notifications |
| `push_subscriptions` | Web push subscriptions |

### Key Relationships

- `bookings.coach_id` → `profiles.id`
- `booking_offers.booking_id` → `bookings.id`
- `booking_offers.referee_id` → `profiles.id`
- `messages.thread_id` → `threads.id`
- `referee_profiles.profile_id` → `profiles.id`

---

## Critical Systems

These are the production-hardened systems future changes need to respect. Each section gives the where + why so you don't have to re-derive design intent.

### Wallet & Escrow

| Path | Module |
|---|---|
| Top-up via Stripe Checkout | `src/app/app/wallet/actions.ts` `createTopUpSession` |
| Atomic withdraw (3-step pattern) | `wallet_withdraw_begin` → `stripe.transfers.create({idempotencyKey})` → `wallet_withdraw_finalise` / `_cancel`. Audit table `withdrawal_requests` |
| Escrow hold on offer accept | `escrow_hold` RPC inside `acceptOffer` |
| Escrow release | `escrow_release` RPC, called by the cron — never inline. `0144_dual_completion_confirmation.sql` |
| Webhook handler | `src/app/api/webhooks/stripe/route.ts` — idempotent via `webhook_events` table (`0142`) |

Idempotency keys on **every** Stripe write. Money-loss bug from the pre-launch plan was the inline `transfers.create` → RPC failure leaving the user debited. Don't reintroduce that pattern.

### Notification System

**Three transports, in-app row always written:**

1. **In-app** — `create_notification` SECURITY DEFINER RPC writes the bell-icon row. Granted to `authenticated` and `service_role` only — NOT `anon`.
2. **Web Push (VAPID)** — `web-push` lib in `src/lib/notifications.ts:sendWebPush`. VAPID validation in `src/lib/push/validate.ts` uses **ECDH on P-256** (NOT JWK slicing — that was the SOS bug from Sentry WHISTLE-CONNECT-1).
3. **FCM (firebase-admin)** — for native app wrappers (PWA + future Capacitor). `src/lib/firebase-admin.ts`.

**Single entry point**: `createNotification({ userId, title, message, type, link?, urgency? })` in `src/lib/notifications.ts`. Internally prefers `createAdminClient()` (service-role) so cron + system contexts can fire — falls back to cookie client in local dev. Don't write notifications by inserting directly into the table; always go through this function.

**23 call sites audited**, all wired correctly. Key triggers:

| Where | Trigger |
|---|---|
| `acceptOffer` | Coach gets "Booking Confirmed!" |
| `confirmRefereeAvailability` | Ref gets "You're Booked In!" |
| `claimSOSBooking` | Coach gets "SOS Claimed!" with sos urgency |
| Booking actions: complete | Other party gets "Confirm match" (warning) or "Match Confirmed" |
| Cron escrow-release | Coach: "Payment Released", Ref: "Payment Received" |
| Disputes | All admins get titled notification with booking identity |
| New chat message | Other participants get sender name as title + body preview |

### Messaging Threads

Thread creation on booking confirmation goes through **`src/lib/messaging/ensure-thread.ts`** — idempotent helper that:

- Uses the service-role client to bypass RLS edge cases
- Creates the `threads` row, upserts both `thread_participants`, writes the system "Booking confirmed" message
- Returns `{ threadId }` on success or `{ error }` on failure
- Sentry-captures any degrade with `msg.flow=<accept-offer|coach-accept-availability|claim-sos>`

Three call sites: `acceptOffer`, `confirmRefereeAvailability`, `claimSOSBooking`. **Never inline thread creation again** — the previous inline approach silently orphaned bookings (booking confirmed, no chat surface). The `Message {name}` button on `/app/bookings/[id]` only renders if a `threads` row exists, so an orphan = no path to chat.

### Cron Jobs

Schedules in `vercel.json`:

| Path | Cadence | What it does |
|---|---|---|
| `/api/cron/escrow-release` | `*/15 * * * *` | Path A: mutual-confirm releases (status=completed + both_confirmed_at). Path B: kickoff+48h fallback. Skips on open dispute. Fires nudge notifications 24h after first mark. |
| `/api/cron/reconcile` | `0 6 * * 1` (weekly) | Detects wallet balance mismatches + bookings with escrow stuck >7 days. Notifies admins. |

**Auth**: Bearer `CRON_SECRET`. Vercel auto-injects this header for cron-triggered requests. If `CRON_SECRET` env var isn't set in Production, all cron requests 401 silently — and Vercel Hobby plan throttles crons to once-per-day regardless of schedule string. For real sub-daily schedules at scale, Pro plan is needed (or move to Supabase pg_cron).

### Admin Endpoints (Bearer CRON_SECRET)

| Endpoint | Use |
|---|---|
| `POST /api/admin/broadcast-push` | System-wide announcement to every profile. Body: `{ title, message, link?, type?, dryRun? }`. dryRun returns recipient count without firing. |
| `GET /api/admin/push-debug` | Returns VAPID env var state (public key fingerprint, lengths, quote/whitespace flags) so you can verify the running deploy has the right keys after a rotation. |
| `GET /api/sentry-test` | Throws when enabled — test fixture for `/sentry-example-page`. Gated behind `SENTRY_TEST_ROUTES_ENABLED`; returns 404 unless that env var is exactly `'true'`. |

`/sentry-example-page` is the Sentry verification UI: three buttons fire captured client error / unhandled client error / server-side error. **Gated** behind `SENTRY_TEST_ROUTES_ENABLED` (404 unless `'true'`) — set the env var in Vercel Production, redeploy, verify after deploy, then unset it.

### Sentry

Already fully installed — **don't re-run `@sentry/wizard`**, it'll clobber the customisations. Files involved:

- `src/instrumentation.ts` — server runtime + `onRequestError` hook
- `src/instrumentation-client.ts` — browser bundle init (`sendDefaultPii: true`, `tracesSampleRate: 0.1`, env tagging)
- `sentry.{server,edge}.config.ts`
- `next.config.ts` — `withSentryConfig` wrapper, source map upload, `/monitoring` tunnel route

Org: `whistle-connect` on EU region (`https://de.sentry.io`). Issues are namespaced as `WHISTLE-CONNECT-N`.

Key event tags to filter on:
- `escrow.flow` — `release`, `release-notify`, `refund`
- `msg.flow` — `accept-offer`, `coach-accept-availability`, `claim-sos`, `ensure-thread.{find,create,participants,system-message}`
- `push.transport` — `web`, `firebase`
- `push.failure` — `vapid-malformed`, `vapid-mismatch`, `vapid-missing`

### VAPID Keys

`.env.vapid` is **gitignored** (always was — pre-launch plan claimed it was committed; it wasn't). Don't rotate without reason; the existing keys are not compromised.

If you DO rotate:
1. Generate new pair: `npx web-push generate-vapid-keys`
2. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` in Vercel Production (no surrounding quotes — Vercel stores quotes literally).
3. Redeploy (env changes don't apply until next build).
4. `DELETE FROM push_subscriptions WHERE platform='web'` — old subs are bound to old public key and will 403 on any send.
5. Verify via `GET /api/admin/push-debug` (with Bearer `CRON_SECRET`).

---

## Development Patterns

### Server Actions

All data mutations use Next.js Server Actions in `actions.ts` files:

```typescript
'use server'

export async function actionName(params) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // ... operation

    revalidatePath('/app/...')
    return { success: true }
}
```

### Error Handling Convention

Return `{ error: string }` or `{ success: true }` from actions:

```typescript
// Good
return { error: 'Booking not found' }
return { success: true }

// Avoid mixing patterns (throwing vs returning)
```

### Supabase Queries

Use the SSR client for server components and actions:

```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data, error } = await supabase.from('table').select('*')
```

### Component Patterns

- Server Components by default (no 'use client' unless needed)
- Client Components for interactivity (`'use client'` directive)
- UI primitives in `src/components/ui/`
- Feature components in `src/components/app/`

---

## Known Issues (Priority Order)

> Reconciled 2026-05-15 (pre-FA-trial cleanup pass). Items 1–6 from the
> previous list were verified against the live code/DB and are **resolved** —
> they're now in the Resolved section. Don't re-"fix" already-correct code.

### Still Open

1. **Hobby-tier Vercel Cron throttle**
   - Real cadence on Hobby is once-per-day regardless of schedule string. Fine for soft launch, must upgrade to Pro before real volume — or move escrow-release to Supabase pg_cron.

2. **`authenticated` can execute SECURITY DEFINER RPCs directly** (advisor lint 0029)
   - Money/booking RPCs (`confirm_booking`, `mark_booking_complete`, `wallet_withdraw_*`, `charge_sos_fee`, `escrow_refund`, `claim_sos_booking`, `archive_offer_*`) are callable by any signed-in user via `/rest/v1/rpc/...`, not just through the app's server actions.
   - Migration `0140` documents this as an accepted tradeoff (the RLS-helper subset *must* keep the `authenticated` grant). Proper fix is per-function `auth.uid()` guards or moving non-helper RPCs to a private schema — its own PR, not a trial blocker. **`anon`/`PUBLIC` exposure was the real hole and is closed by `0155`.**

3. **PostGIS in `public` schema** (advisor lints 0013/0014)
   - `postgis` extension + `spatial_ref_sys` live in `public`. `spatial_ref_sys` is a static SRID lookup (no sensitive data); the migration role can't `ALTER` extension-owned objects. Moving PostGIS to its own schema is an invasive, separately-tested migration. Accepted, same stance as `0138`.

4. **Auth: leaked-password protection disabled** (advisor)
   - HaveIBeenPwned check is off. This is a Supabase **dashboard** setting (Auth → Policies), not a DDL change — toggle it on before the trial.

### Resolved (kept for context, do not regress)

- ✅ **Overly permissive RLS (`WITH CHECK (true)`)** — fixed by migrations `0111` (table-level policies) + `0136` (booking_offers referee insert). Live security advisor shows no table RLS lints (only the accepted PostGIS `spatial_ref_sys` one).
- ✅ **Function-level security advisor lints** — `0138`/`0139` swept `search_path` + `anon` EXECUTE; `0140` restored the RLS-helper `authenticated` grants. Regressed by later `CREATE OR REPLACE` migrations; **re-swept by `0155_security_advisor_resweep`** (pins `search_path`, revokes `anon`+`PUBLIC` on every owned SECDEF function). `0155` is in the repo but must be applied via the normal migration/deploy flow.
- ✅ **Profile creation race condition** — `src/lib/auth/actions.ts` now uses a bounded retry-with-backoff loop, not the old fixed 500ms `setTimeout`.
- ✅ **`confirmPrice` no-op stub** — removed (2026-05-15). Referee acceptance is atomic via `acceptOffer`'s RPC. `confirmPriceSchema` is retained (still validated by `acceptOffer`).
- ✅ **Missing authorization on `cancelBooking` / `deleteBooking`** — both verify the caller (coach or assigned referee / `coach_id` ownership) before mutating.
- ✅ **Unsafe `as any` in bookings/actions.ts** — none remain.
- ✅ **N+1 in `getThreads`** — now 3 batched queries (participations, threads+joins, all messages) with `.range()` pagination.
- ✅ **Sentry test routes unauthenticated** — `/sentry-example-page` + `/api/sentry-test` now gated behind `SENTRY_TEST_ROUTES_ENABLED` (404 unless exactly `'true'`).
- ✅ **Web push silently broken** — VAPID validation `validate.ts` was rejecting every valid keypair (broken JWK slicing). Fixed via ECDH-on-P256 derivation. See Sentry WHISTLE-CONNECT-1.
- ✅ **Cron 401 silent failure** — `CRON_SECRET` must exist in Vercel Production env AND a deploy must have happened since it was set; env changes need a redeploy.
- ✅ **`createNotification` permission denied from cron** — was using cookie-aware `createClient()` which runs as `anon`. Now prefers `createAdminClient()` so cron + system contexts work.
- ✅ **Orphaned booking threads** — inline thread creation could fail silently. Now via `ensureBookingThread` helper at every confirmation path (offer accept, availability accept, SOS claim).
- ✅ **SOS claim never created a thread** — `claim_sos_booking` RPC didn't, and no JS-side fallback existed. Now `claimSOSBooking` calls `ensureBookingThread` post-RPC.
- ✅ **Atomic withdraw money-loss** — Stripe transfer succeeded then RPC failed leaving balance unchanged. Now `withdrawal_requests` audit table + 3-step pattern.
- ✅ **Disputes 10-char prompt()** — replaced with `DisputeFormModal` (category radio cards, optional incident timestamp, 50-char-min reason, desired_outcome). Migration `0145`.
- ✅ **Refs default to unavailable** — column default flipped to `true` (migration `0146`). Existing rows untouched.
- ✅ **Missing referee_id silent skip in escrow release notification** — now console.error + Sentry capture.

- ✅ **Web push silently broken** — VAPID validation `validate.ts` was rejecting every valid keypair (broken JWK slicing). Fixed via ECDH-on-P256 derivation. See Sentry WHISTLE-CONNECT-1.
- ✅ **Cron 401 silent failure** — `CRON_SECRET` must exist in Vercel Production env AND a deploy must have happened since it was set; env changes need a redeploy.
- ✅ **`createNotification` permission denied from cron** — was using cookie-aware `createClient()` which runs as `anon`. Now prefers `createAdminClient()` so cron + system contexts work.
- ✅ **Orphaned booking threads** — inline thread creation could fail silently. Now via `ensureBookingThread` helper at every confirmation path (offer accept, availability accept, SOS claim).
- ✅ **SOS claim never created a thread** — `claim_sos_booking` RPC didn't, and no JS-side fallback existed. Now `claimSOSBooking` calls `ensureBookingThread` post-RPC.
- ✅ **Atomic withdraw money-loss** — Stripe transfer succeeded then RPC failed leaving balance unchanged. Now `withdrawal_requests` audit table + 3-step pattern.
- ✅ **Disputes 10-char prompt()** — replaced with `DisputeFormModal` (category radio cards, optional incident timestamp, 50-char-min reason, desired_outcome). Migration `0145`.
- ✅ **Refs default to unavailable** — column default flipped to `true` (migration `0146`). Existing rows untouched.
- ✅ **Missing referee_id silent skip in escrow release notification** — now console.error + Sentry capture.

---

## Recent Migrations

The numbering jumped from `0109` to timestamped (`20260429*`) names when Supabase migration tracking was reset. Latest by content:

| Number | Content |
|---|---|
| 0142 | `webhook_events_log` — Stripe webhook idempotency |
| 0143 | `atomic_withdraw` — `withdrawal_requests` table + split RPCs |
| 0144 | `dual_completion_confirmation` — `coach_marked_complete_at`, `referee_marked_complete_at`, `both_confirmed_at` columns + `mark_booking_complete` RPC |
| 0145 | `dispute_structured_fields` — `category`, `desired_outcome`, `incident_at` |
| 0146 | `default_referees_available` — flipped column default |
| 0147 | `truncate_web_push_subscriptions` — only run if rotating VAPID keys |
| 0148 | `wallet_descriptions_breakdown` — wallet transaction description detail |
| 0149 | `per_user_booking_archive` — per-user booking archive (not global) |
| 0150 | `confirm_booking_accepts_price` — `confirm_booking` price arg |
| 0151 | `offer_per_user_archive` — per-user offer archive |
| 0152 | `thread_participant_archive` — per-user thread archive |
| 0153 | `add_tournament_booking_type` — tournament booking type |
| 0154 | `sos_premium_fee` — SOS premium fee (uses booking ref type) |
| 0155 | `security_advisor_resweep` — re-pin `search_path` + revoke `anon`/`PUBLIC` EXECUTE on owned SECDEF functions (regressed by 0143–0154 `CREATE OR REPLACE`). **Apply via the normal migration/deploy flow.** |

> Note: `supabase/migrations/RUN_THIS_NOW.sql` is loose scratch SQL, not a
> tracked migration — ignore it / it should be removed.

---

## Improvement Roadmap

### Phase 1: Security Hardening
- [x] Fix overly permissive RLS policies (migrations `0111`/`0136`)
- [x] Add authorization checks to `cancelBooking` / `deleteBooking`
- [x] Function-level advisor sweep (`0138`/`0139`/`0140`, re-swept `0155`)
- [ ] Per-function `auth.uid()` guards / private schema for non-helper SECDEF RPCs (advisor 0029 — see Still Open #2)
- [ ] Move PostGIS out of `public` schema (advisor 0013/0014 — see Still Open #3)
- [ ] Enable leaked-password protection (dashboard toggle — see Still Open #4)

### Phase 2: Code Quality
- [x] Standardize error handling pattern (single `{ success, error }` shape across actions)
- [x] Remove remaining `as any` casts in bookings/actions.ts (none remain)

### Phase 3: Performance
- [x] Fix N+1 in getThreads (3 batched queries)
- [x] Add pagination to list queries (`getThreads` uses `.range()`)

### Phase 4: Features
- [ ] iOS Safari non-PWA messaging (detect non-standalone, suggest "Add to Home Screen" instead of dead permission prompt)
- [ ] Phase 2 Stripe webhook handlers (`transfer.failed`, `charge.refunded`, `charge.dispute.created`, `payout.*`)
- [ ] FCM client SDK integration for native wrapper (Capacitor)
- [ ] Service worker `notificationclick` — focus existing tab if open

---

## Environment Variables

Required in `.env.local` (and Vercel Production):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=               # required — service-role client for cron + system flows

# Site canonical URL (must match Stripe success/cancel URLs + Connect return URL)
NEXT_PUBLIC_SITE_URL=https://www.whistleconnect.co.uk

# Web Push (VAPID) — generated once via `npx web-push generate-vapid-keys`
NEXT_PUBLIC_VAPID_PUBLIC_KEY=            # 87 chars, no quotes
VAPID_PRIVATE_KEY=                       # 43 chars, no quotes
VAPID_SUBJECT=mailto:tom@onesignanddigital.co.uk

# FCM (firebase-admin) — for native push transport (PWA + future Capacitor)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Stripe (live keys for production; test keys for preview)
STRIPE_SECRET_KEY=                       # sk_live_… or sk_test_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=                   # whsec_… from the live webhook endpoint

# Cron — Vercel auto-injects Bearer header on cron-triggered requests
CRON_SECRET=                             # 32-byte URL-safe random; needed by /api/cron/* AND /api/admin/* endpoints

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=                       # for source map upload at build time
SENTRY_TEST_ROUTES_ENABLED=              # unset/false in prod; set to 'true' to expose /sentry-example-page + /api/sentry-test for post-deploy verification, then unset

# Feature kill switches (default true — set 'false' to disable)
WALLET_TOPUPS_ENABLED=true
WITHDRAWALS_ENABLED=true
WEB_PUSH_ENABLED=true

# Mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=

# Resend (FA verification emails)
RESEND_API_KEY=
```

**Important**: Vercel does NOT hot-reload env vars. After changing any value, redeploy via Vercel UI (Deployments tab → ⋯ → Redeploy) or push a new commit.

---

## Quick Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
```

---

## Testing Checklist

When making changes, verify:

1. **Auth Flow**: Login/Register works, session persists
2. **Booking Flow**: Create → Search → Offer → Accept → Confirm → Mutual mark complete → Escrow releases on next cron tick
3. **Messaging**: Thread creation on confirmation, message send/receive, "Message {name}" button on `/app/bookings/[id]` for both coach and ref
4. **Notifications**: In-app row writes AND OS-level push delivers (test with `/api/admin/broadcast-push` dryRun first)
5. **Availability**: Recurring and date-specific slots saved; new refs default to `is_available=true`
6. **Disputes**: Modal renders with category/incident/reason/outcome; admin notification includes booking identity
7. **Wallet**: Top-up via Stripe Checkout credits balance via webhook, withdraw uses atomic 3-step pattern, no orphaned `withdrawal_requests` rows >1h old

After changes that touch Stripe, push, or Supabase RPCs:
- Check Sentry for new issues tagged with relevant `escrow.flow` / `msg.flow` / `push.failure` / `push.transport`
- Check `/api/admin/push-debug` (Bearer CRON_SECRET) returns matching VAPID public key fingerprint
- Curl `/api/cron/escrow-release` with Bearer CRON_SECRET — should return `{ success: true, releases_mutual, releases_fallback, errors: [] }`

---

## Notes for AI Assistants

### Working with this codebase

- Always use `await createClient()` for Supabase (server client is async)
- Check user authentication before any data operation
- Use `revalidatePath()` after mutations to refresh UI
- Prefer editing existing files over creating new ones
- Follow existing patterns in the codebase
- Run `npx tsc --noEmit` to verify no TypeScript errors before committing
- Run `npx eslint <changed-files>` for lint
- Master pushes are blocked by user permission rule — open a PR via `gh pr create` instead

### When to use which Supabase client

- **`createClient()`** (cookie-aware, anon) — server components, server actions reacting to a user's request, anything that needs RLS to enforce per-user scoping.
- **`createAdminClient()`** (service-role, bypasses RLS) — cron jobs, system-driven flows (notification fan-out, thread creation on booking confirmation, webhook handlers, admin endpoints). Returns `null` if `SUPABASE_SERVICE_ROLE_KEY` is missing — always guard.

The `createNotification` function and the `ensureBookingThread` helper are designed to use admin client internally so callers don't have to think about it.

### Don't reintroduce these patterns

- ❌ **Inline thread creation** in offer/SOS flows — use `ensureBookingThread`.
- ❌ **`prompt()` for any user input** — use proper modal components from `src/components/ui/Modal.tsx`.
- ❌ **JWK string-slicing** for VAPID — use ECDH derivation. The `validate.ts` file is correct, don't "simplify" it back.
- ❌ **`stripe.transfers.create` then RPC** — use the 3-step atomic withdraw pattern.
- ❌ **`forEach(async ...)`** — `Promise.allSettled` for fan-out, `for ... of` for sequential.
- ❌ **Re-running `@sentry/wizard`** — Sentry is fully configured with custom options the wizard would clobber.

### When fixing notification call sites

There are 23 call sites using `createNotification`. If adding a new one, follow this checklist:

1. Pass an explicit `userId` (the recipient) — never group/role-broadcast in one call.
2. Title should fit in a phone toast banner (~50 chars).
3. Message should include the **money figure + venue/date** when relevant — admins / users skim notifications.
4. `link` should go to the most actionable page (the specific booking, not a list).
5. `type`: `'success'` for positives, `'warning'` for action-required-with-money, `'error'` for failures, `'info'` for neutral.
6. `urgency: 'sos'` only for genuine SOS broadcasts — not for general urgency.
