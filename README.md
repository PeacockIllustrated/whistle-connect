# Whistle Connect

Grassroots football operations app. Coaches book qualified referees for matches and tournaments; referees publish availability, accept offers, and get paid out via Stripe Connect. Match payments sit in escrow until both parties mark the fixture complete.

Live at [www.whistleconnect.co.uk](https://www.whistleconnect.co.uk).

## Status

Soft-launched. Post-launch hardening is complete (atomic withdraw, dual-confirm escrow, structured disputes, idempotent webhooks, Sentry observability, web push fix). Active backlog and known issues live in [CLAUDE.md](CLAUDE.md#known-issues-priority-order).

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4, Lucide icons |
| Language | TypeScript 5 (strict) |
| Database / Auth / Realtime / Storage | Supabase |
| Payments | Stripe Checkout (top-ups), Stripe Connect Express (referee payouts), Stripe Transfers |
| Notifications | Web Push (VAPID) + FCM (firebase-admin); in-app row always written |
| Native shells | Capacitor (iOS + Android — not yet shipped) |
| Email | Resend (FA verification) |
| Maps | Mapbox |
| Cron | Vercel Cron (`vercel.json`) |
| Observability | Sentry (`@sentry/nextjs`, EU region) |
| Hosting | Vercel, custom domain `www.whistleconnect.co.uk` |
| Tests | Vitest (unit), Playwright (e2e) |

## Core features

### Bookings
- Workflow: `draft → pending → offered → confirmed → completed` (or `cancelled`)
- Direct invite to a specific referee, broadcast to feed, or Tournament type
- Central-venue price field for multi-pitch sites
- Per-user archive with swipe-to-archive on mobile
- Edit locked once both parties confirm
- Referee archive falls back to the original offer when no assignment exists

### SOS broadcasts
- £1.99 premium fee per broadcast, pooled into the booking escrow as an anti-spam gate
- Claim and decline buttons on the SOS detail page
- Soft-delete rollback if a broadcast is cancelled
- Feed pops new SOS to the top for active referees
- Reference type normalised to `booking` end-to-end

### Offers
- Workflow: `sent → accepted_priced → accepted` (or `declined` / `withdrawn`)
- Swipe-to-clear declined offers
- Post-and-wait pricing flow (coach posts; referee names a price)
- £0 offered fee hidden in the UI until a real number is set

### Wallet and payouts
- Stripe Checkout for top-ups, idempotent webhooks logged in `webhook_events_log`
- Stripe Connect Express onboarding for referees, with Connect-onboarding error handling
- Atomic 3-step withdraw: `wallet_withdraw_begin` → `stripe.transfers.create` (with idempotency key) → `wallet_withdraw_finalise` / `_cancel`, audited via `withdrawal_requests`
- Top-up modal lifted above the bottom nav on mobile

### Escrow
- Held on offer accept via `escrow_hold` RPC
- Dual-confirmation gate: when both `coach_marked_complete_at` and `referee_marked_complete_at` are set, status becomes `completed` and escrow releases on the next 15-minute cron tick
- Fallback release at kickoff + 48h if neither party confirms
- Open dispute blocks both release paths
- Nudge notification 24h after the first mark

### Disputes
- Structured modal: category radio cards, optional incident timestamp, 50-char-minimum reason, desired outcome
- All admins notified with booking identity in the title
- Window: any time after `confirmed` until escrow is released

### Messaging
- Idempotent thread creation via `ensureBookingThread` on every confirmation path (offer accept, availability accept, SOS claim) — no more orphaned bookings
- Named `Message {name}` CTA on confirmed booking pages for both coach and referee
- Thread archive on signup-consent flow
- System "Booking confirmed" message written on thread creation

### Notifications
- Three transports: in-app row (`notifications` table), Web Push (VAPID, ECDH on P-256), FCM (native shells)
- Single entry point: `createNotification({ userId, title, message, type, link?, urgency? })` — service-role internally so cron and system flows can fire
- Admin broadcast endpoint with `dryRun` recipient count
- Push-debug endpoint to verify VAPID key state on the running deploy

### Availability
- Recurring weekly slots and date-specific overrides
- New referees default to `is_available=true`

### Admin
- Operations triage dashboard
- County FA email routing for verification
- Referee verification (DBS, level)
- Platform health and roadmap surface
- Bearer-`CRON_SECRET` admin endpoints (broadcast push, push debug, Sentry test)

### Auth
- Supabase email/password
- Signup consent capture
- Role-based booking chooser post-login (coach vs referee landing)
- Roles: `coach`, `referee`, `admin`

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You will need a `.env.local` with Supabase, Stripe, VAPID, FCM, Sentry, Mapbox, Resend, and `CRON_SECRET` values. The full list with notes is in the [Environment Variables section of CLAUDE.md](CLAUDE.md#environment-variables).

After deploying or rotating env vars, sanity-check:

- `/sentry-example-page` — three buttons that fire client / unhandled / server errors
- `GET /api/admin/push-debug` (Bearer `CRON_SECRET`) — VAPID key fingerprint + env state
- `GET /api/cron/escrow-release` (Bearer `CRON_SECRET`) — should return `{ success: true, releases_mutual, releases_fallback, errors: [] }`

## Scripts

| Script | Use |
|--------|-----|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:e2e` | Playwright end-to-end |
| `npm run test:e2e:ui` | Playwright with UI |
| `npm run cap:sync` | Sync web build into Capacitor shells |
| `npm run cap:open:android` / `cap:open:ios` | Open native projects |
| `npm run cap:run:android` / `cap:run:ios` | Build and run on device |

## Project structure

```
src/
  app/            Next.js App Router (auth, /app/* protected, /book public, /api)
  components/     UI primitives + feature components
  lib/            Supabase clients, auth actions, notifications, types, utils
  middleware.ts   Auth route protection
supabase/
  migrations/     Ordered SQL migrations (latest: dual completion, structured disputes, atomic withdraw)
  emails/         Email templates
docs/             Native push setup, wallet/escrow design specs
```

Full directory map and key tables are in [CLAUDE.md](CLAUDE.md#directory-structure).

## Cron

Schedules in `vercel.json`:

| Path | Cadence | Purpose |
|------|---------|---------|
| `/api/cron/escrow-release` | `*/15 * * * *` | Mutual-confirm releases + kickoff+48h fallback + 24h nudges |
| `/api/cron/reconcile` | `0 6 * * 1` | Weekly: detect wallet mismatches and stuck escrow >7 days, notify admins |

Vercel Hobby tier throttles cron to once per day regardless of schedule string. Production cadence requires Vercel Pro or moving to Supabase pg_cron.

## Deployment

Vercel auto-deploys from `master`. Master pushes are blocked locally — open a PR via `gh pr create`.

Important: Vercel does not hot-reload env vars. After changing any value in the Vercel dashboard, redeploy (Deployments → ⋯ → Redeploy) or push a new commit before the change takes effect.

Source maps upload to Sentry at build time via `withSentryConfig` in `next.config.ts`. Issues are namespaced as `WHISTLE-CONNECT-N` in the EU region (`https://de.sentry.io`, org `whistle-connect`).

## Further reading

- [CLAUDE.md](CLAUDE.md) — full system architecture, critical-systems map, patterns to avoid, current known issues, recent migrations
- [docs/NATIVE_PUSH_SETUP.md](docs/NATIVE_PUSH_SETUP.md) — Capacitor + FCM setup
- [docs/superpowers/specs/2026-03-31-wallet-escrow-system-design.md](docs/superpowers/specs/2026-03-31-wallet-escrow-system-design.md) — wallet/escrow design notes
- [docs/superpowers/plans/2026-03-31-wallet-escrow-system.md](docs/superpowers/plans/2026-03-31-wallet-escrow-system.md) — original wallet plan
