# Wallet & Escrow System Design

## Overview

A wallet system for Whistle Connect that enables coaches to fund bookings through an in-app wallet, holds funds in escrow during confirmed bookings, and releases payment to referees after match completion. Stripe handles all real money custody; the app database serves as the accounting ledger.

## Architectural Principle: Stripe as Custodian

All real money lives in Stripe at all times. The application database tracks balances and transactions as a ledger, but never holds or moves actual funds. This keeps Whistle Connect outside money transmission regulations — Stripe bears that compliance burden.

- **Top-up**: Money held by Stripe (customer balance / payment intent)
- **Internal movements** (escrow hold, release): Ledger entries in DB; no real money moves until payout
- **Escrow release**: Triggers Stripe Transfer to referee's connected account
- **Withdrawal**: Stripe pays out from connected account to referee's bank

---

## Database Schema

### `wallets`

One per user. Created for coaches on first top-up; created for referees on first escrow release to them.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → profiles, UNIQUE |
| balance_pence | INTEGER | Available funds (not in escrow), default 0 |
| escrow_pence | INTEGER | Funds held for confirmed bookings, default 0 |
| currency | TEXT | Default 'GBP' |
| stripe_customer_id | TEXT | Stripe customer ID for coaches |
| stripe_connect_id | TEXT | Stripe Connect account ID for referees |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `wallet_transactions`

Immutable audit log. Never updated or deleted.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| wallet_id | UUID | FK → wallets |
| type | TEXT | `top_up`, `escrow_hold`, `escrow_release`, `escrow_refund`, `withdrawal`, `platform_fee` |
| amount_pence | INTEGER | Always positive |
| direction | TEXT | `credit` or `debit` |
| balance_after_pence | INTEGER | Snapshot of `balance_pence` after this transaction (available funds only, excludes escrow) |
| reference_type | TEXT | `booking`, `stripe_checkout`, `stripe_payout`, `admin_action` |
| reference_id | TEXT | ID of relevant record (booking ID, Stripe session ID, etc.) |
| stripe_transfer_id | TEXT | Stripe Transfer ID when real money moves, nullable |
| description | TEXT | Human-readable note |
| created_at | TIMESTAMPTZ | |

### `disputes`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| booking_id | UUID | FK → bookings |
| raised_by | UUID | FK → profiles |
| reason | TEXT | Required |
| status | TEXT | `open`, `resolved_coach`, `resolved_referee`, `resolved_split` |
| admin_notes | TEXT | |
| admin_user_id | UUID | FK → profiles, who resolved it |
| resolved_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### Key constraints

- `wallets.user_id` is UNIQUE — one wallet per user
- `wallet_transactions` are INSERT-only — no UPDATE or DELETE
- `balance_after_pence` on each transaction enables reconciliation against `wallets.balance_pence`
- All balance mutations use `SELECT ... FOR UPDATE` on the wallet row inside a transaction to prevent race conditions

---

## Money Flow

### 1. Coach Top-Up

1. Coach clicks "Add Funds" (dashboard modal or `/app/wallet/top-up`)
2. Selects amount (presets: £10, £20, £50 or custom). Minimum: £5
3. App calculates Stripe fee (slight over-estimate) and shows total: "£20 + ~£0.51 fee = £20.51"
4. Creates Stripe Checkout session with the total charge amount
5. Coach completes payment on Stripe hosted page
6. Stripe fires `checkout.session.completed` webhook
7. Webhook handler:
   - Verifies Stripe signature
   - Checks idempotency (no existing transaction for this Stripe session ID)
   - Credits wallet with the exact post-fee amount (charge minus actual Stripe fee)
   - Creates `wallet_transaction`: type=`top_up`, direction=`credit`
8. Coach returns to app, sees updated balance

### 2. Booking Confirmation (Escrow Hold)

1. Coach confirms referee's price (e.g., £15) on a booking
2. Server calls atomic RPC function that:
   - `SELECT ... FOR UPDATE` on coach's wallet row
   - Checks `balance_pence >= 1500`
   - If insufficient: returns error "Insufficient funds"
   - If sufficient:
     - `balance_pence -= 1500`
     - `escrow_pence += 1500`
     - Creates `wallet_transaction`: type=`escrow_hold`, direction=`debit`
     - Runs existing booking confirmation logic (accept offer, create assignment, update status)
3. All of the above is one atomic DB transaction — either everything succeeds or nothing does
4. If balance check fails, UI shows top-up modal with shortfall pre-filled (e.g., "Add £5 to continue")

### 3. Auto-Release (24 Hours After Kickoff)

Scheduled job (`/api/cron/escrow-release`) runs every 15 minutes:

**18-hour nudge:**
- Finds confirmed bookings where `kickoff_time + 18h` has passed, no nudge sent
- Sends push notification to coach: "Your match with [referee] will auto-complete in 6 hours. Raise a dispute if there was an issue."

**24-hour release:**
- Finds confirmed bookings where `kickoff_time + 24h` has passed AND no open dispute AND escrow not yet released
- For each booking (each in its own transaction):
  1. Coach wallet: `escrow_pence -= amount`
  2. Creates `wallet_transaction` on coach: type=`escrow_release`, direction=`debit`
  3. Referee wallet: `balance_pence += amount` (minus platform fee if enabled in future)
  4. Creates `wallet_transaction` on referee: type=`escrow_release`, direction=`credit`
  5. Triggers Stripe Transfer to referee's connected account (real money movement)
  6. Booking status → `completed`
  7. Push notification to both parties

Job is fully idempotent — uses a flag/timestamp on the booking to prevent double processing.

### 4. Dispute Flow

1. Coach or referee raises dispute before 24h window closes
2. `dispute` record created with status `open`
3. Auto-release is blocked for this booking (cron skips bookings with open disputes)
4. Admin receives notification
5. Admin reviews and resolves:
   - `resolved_coach` → escrow refunded to coach wallet balance
   - `resolved_referee` → escrow released to referee wallet + Stripe Transfer
   - `resolved_split` → partial amounts to each
6. Admin must provide `admin_notes` explaining the decision (required field)

### 5. Cancellation (Before Match)

Either party cancels a confirmed booking:
1. Escrow refunded to coach wallet:
   - `escrow_pence -= amount`
   - `balance_pence += amount`
   - `wallet_transaction`: type=`escrow_refund`, direction=`credit`
2. Booking status → `cancelled`
3. No real money moves in Stripe (funds were only ledger-held)

### 6. Referee Withdrawal

1. Referee requests withdrawal from `/app/wallet/withdraw`
2. Minimum withdrawal: £5
3. If not yet connected to Stripe → Stripe Connect onboarding flow
4. If connected:
   - Enter withdrawal amount
   - App triggers Stripe payout from connected account to referee's bank
   - `balance_pence -= amount`
   - `wallet_transaction`: type=`withdrawal`, direction=`debit`

### 7. Coach Withdrawal

Coaches can withdraw unused wallet balance (funds not held in escrow):
1. Coach requests withdrawal from `/app/wallet`
2. Minimum withdrawal: £5
3. Only `balance_pence` is withdrawable — `escrow_pence` is locked
4. Processed as Stripe refund to original payment method or bank transfer
5. `balance_pence -= amount`
6. `wallet_transaction`: type=`withdrawal`, direction=`debit`

### 8. Admin Override (Safety Net)

Admin can reverse a completed release within 7 days:
1. Checks referee's current balance — if referee has already withdrawn the funds, reversal is limited to their remaining balance. Admin must handle the shortfall outside the system (e.g., contact referee directly).
2. Creates corrective transactions (debit referee, credit coach)
3. `reference_type: 'admin_action'`
4. Requires `admin_notes` with reason
5. Triggers corresponding Stripe reversal where possible

---

## Platform Fee (Future-Ready)

Infrastructure supports a platform fee but launches with 0%.

- `platform_fee_pence` column added to `booking_offers` or calculated at release time
- On escrow release: `referee_receives = escrow_amount - platform_fee`
- Platform fee recorded as separate `wallet_transaction` with type=`platform_fee`
- Fee percentage/amount configurable via admin settings

---

## Pages & UI

### New Pages

**`/app/wallet`** — Wallet dashboard
- Current balance, escrow held (coaches), pending withdrawals (referees)
- "Add Funds" button (coaches) / "Withdraw" button (referees)
- Transaction history with filters (type, date range)

**`/app/wallet/top-up`** — Full top-up page (alternative to modal)
- Preset amounts + custom input
- Fee breakdown preview
- Redirects to Stripe Checkout

**`/app/wallet/withdraw`** — Referee withdrawal
- Available balance display
- Amount input
- Stripe Connect onboarding prompt if not connected
- Confirm and initiate payout

**`/app/disputes`** — Admin dispute management
- Open disputes list
- Booking details, both parties, escrow amount
- Resolution actions with required reason field

### Dashboard Widget

Compact wallet card on the main dashboard (`/app`):
- Balance display + escrow held
- Quick top-up icon/button → opens modal overlay
- Modal contains: preset amounts, custom input, fee preview, "Pay with Stripe" button
- After Stripe return: success state, balance auto-updates
- For referees: balance display + "Withdraw" action

### Modified Existing Pages

**`/app/bookings/[id]`** — Booking detail
- "Confirm Price" shows wallet balance alongside the referee's fee
- Insufficient funds: button disabled, inline top-up modal with shortfall pre-filled
- After confirmation: shows "£15 held in escrow" indicator

**`/app/admin`** — Admin dashboard
- New "Disputes" nav item
- Wallet overview: total funds in system, total in escrow, total paid out
- Admin wallet actions with mandatory audit trail

### Wallet Balance in Navigation

- Small balance indicator in app header for coaches (e.g., "£25.00" with wallet icon)
- Links to `/app/wallet`

---

## Stripe Integration

### Webhook Endpoint

**`/api/webhooks/stripe`** — POST

Handles:
- `checkout.session.completed` → credit coach wallet (top-up)
- `account.updated` → track referee Stripe Connect onboarding status
- `transfer.failed` → flag failed referee payout, alert admin

Security:
- Stripe signature verification via `stripe.webhooks.constructEvent()`
- Idempotency check on Stripe session/transfer ID before processing

### Stripe Connect

- Referees onboard as **Express** connected accounts (least friction)
- Onboarding triggered from `/app/wallet/withdraw` when they first want to cash out
- Not required to accept bookings — funds accumulate in app wallet until they're ready

### Fee Handling

- Stripe fees are passed to the coach (added on top of desired amount)
- At checkout, over-estimate fee slightly for display
- On webhook, credit wallet with `charge_amount - actual_stripe_fee` for accuracy
- Coach always sees what they'll receive in their wallet before paying

---

## Scheduled Jobs

### `/api/cron/escrow-release`

Runs every 15 minutes via Vercel Cron.

1. **18h nudge**: Push notification to coach for upcoming auto-completion
2. **24h release**: Process escrow release for eligible bookings

Each booking processed in its own transaction. Fully idempotent.

### Monitoring

- Alert if cron hasn't run in 30+ minutes
- Log each run with count of processed bookings
- Admin-visible cron health status

---

## Reconciliation & Safety

### Weekly Reconciliation Job

- Sums all `wallet_transactions` per wallet
- Compares against `wallets.balance_pence + wallets.escrow_pence`
- Flags any mismatch for admin review
- Reconciles app ledger against Stripe balances

### Escrow Timeout Alert

- Admin alert if any escrow is held >7 days past match date
- Indicates stuck bookings (cron failure, missing match data, etc.)

### Race Condition Prevention

- All balance mutations use `SELECT ... FOR UPDATE` inside DB transactions
- Escrow hold is atomic with booking confirmation (single RPC)
- No app-level check-then-deduct patterns

---

## RLS Policies

### `wallets`
- Users can SELECT their own wallet (`user_id = auth.uid()`)
- No direct INSERT/UPDATE/DELETE — all mutations via RPC functions (SECURITY DEFINER)
- Admin can SELECT all wallets

### `wallet_transactions`
- Users can SELECT transactions for their own wallet
- No INSERT/UPDATE/DELETE — all via RPC functions
- Admin can SELECT all transactions

### `disputes`
- Users can SELECT disputes for bookings they're involved in
- Users can INSERT disputes for their own bookings (as coach or assigned referee)
- Only admin can UPDATE (resolve) disputes

---

## Migration Strategy

New migration files (ordered after existing 0113):
1. `0114_wallet_tables.sql` — Create `wallets`, `wallet_transactions`, `disputes` tables
2. `0115_wallet_rls.sql` — RLS policies for all new tables
3. `0116_wallet_rpc.sql` — Atomic RPC functions: `escrow_hold`, `escrow_release`, `escrow_refund`, `wallet_top_up`, `wallet_withdraw`
4. `0117_update_confirm_booking_rpc.sql` — Modify existing `confirm_booking` RPC to include escrow hold check

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Insufficient wallet balance | Block confirmation, show inline top-up with shortfall |
| Stripe Checkout fails | No webhook fires, no credit — coach retries |
| Webhook arrives twice | Idempotency check prevents double credit |
| Cron runs overlap | Flag check prevents double release |
| Stripe Transfer fails | Flag transaction, alert admin, retry manually |
| Referee hasn't connected Stripe | Funds accumulate in wallet, prompted to connect on withdraw |
| Booking cancelled after escrow hold | Full escrow refund to coach wallet |
| Escrow stuck (cron failure) | Admin alert after 7 days past match date |
| Balance drift detected | Weekly reconciliation flags mismatch for admin |
| Admin reversal after referee withdrawal | Limited to referee's remaining balance; shortfall handled manually |
| Coach wants money back | Withdraw from available balance (not escrow) via Stripe refund |
