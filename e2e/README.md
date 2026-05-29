# Whistle Connect — e2e tests

Playwright-driven end-to-end coverage for the parts of the app that aren't
worth trusting to unit tests alone (auth, bookings, the new check-in flow,
tournament opt-in, the SOS broadcast filter).

## ⚠️ Never run these against production

The specs and the seed both write to real Supabase rows. They're scoped to
deterministic test-user emails (`test-coach@whistle-test.local`,
`test-referee@whistle-test.local`) and clean up after themselves, but a bug
in a spec could leak. Always run against:

- A Supabase preview branch (Supabase Pro feature — `mcp create_branch`
  if using the MCP, or via the dashboard), or
- A separate test Supabase project, or
- A local `supabase start` instance.

The seed script will hard-refuse to run against the prod whistle-connect
project (`tszyfzctjxlopvsvbinj`). If you genuinely need to override, set
`SEED_ALLOW_PROD=1`.

## One-time setup

1. Point `.env.local` at your test Supabase (URL + anon key +
   service-role key).
2. Apply all migrations to that DB (`npx supabase db push` if using the
   Supabase CLI, or the SQL files via the dashboard).
3. Install deps: `npm install`.
4. Seed test users:
   ```
   npm run seed:test
   ```
   This is idempotent — re-run it any time to refresh passwords or
   restore the referee profile to defaults.

## Running

In one shell:
```
npm run dev
```

In another:
```
npm run test:e2e            # headless run
npm run test:e2e:ui         # Playwright UI for picking + watching specs
npx playwright test e2e/checkin-flow.spec.ts   # single file
```

To tear down the test users + their data when you're done with a test DB:
```
npm run seed:test:clean
```

## What's covered

| Spec | Verifies |
|---|---|
| `auth.spec.ts` | Login + register + forgot-password page loads, invalid-cred error |
| `booking-flow.spec.ts` | Coach can navigate, create a booking, see wallet, hit Stripe |
| `wallet.spec.ts` | Wallet page renders, top-up flow reaches Stripe |
| `admin.spec.ts` | Admin pages render for admin role |
| `checkin-flow.spec.ts` | Check-in window gating, close + far geolocation, coach view |
| `tournament-opt-in.spec.ts` | Toggle persists, search gate filters opted-out refs out |
| `sos-broadcast-filter.spec.ts` | Regression: passive SOS broadcast rows don't render as "Awaiting Coach" |

## Conventions

- Each spec creates its own bookings/offers in `beforeAll` or per test, and
  cleans them up in `finally`. Don't rely on state from other specs.
- The seeded users are shared (idempotent, deterministic). Spec-level
  state (referee opt-ins, etc.) is reset between tests.
- Geolocation is mocked via `context.setGeolocation` + `grantPermissions`.
- DB-only assertions go through the service-role `admin` client from
  `helpers.ts` — they bypass RLS by design (so the spec can read what
  the user just wrote without re-authing as them).
