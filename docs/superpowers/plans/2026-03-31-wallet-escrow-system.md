# Wallet & Escrow System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a wallet system with Stripe-backed escrow so coaches fund bookings via an in-app wallet, funds are held in escrow until 24h after match kickoff, then auto-released to referee wallets.

**Architecture:** App-heavy approach — all wallet/escrow logic lives in Supabase tables and RPC functions. Stripe is used only at the edges: Stripe Checkout for coach top-ups, Stripe Connect for referee payouts. The DB is the accounting ledger; Stripe is the money custodian.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL), Stripe Checkout + Connect, Vercel Cron, TypeScript, Tailwind CSS 4, Zod validation

**Spec:** `docs/superpowers/specs/2026-03-31-wallet-escrow-system-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/0126_wallet_tables.sql` | Create wallets, wallet_transactions, disputes tables |
| `supabase/migrations/0127_wallet_rls.sql` | RLS policies for wallet tables |
| `supabase/migrations/0128_wallet_rpc.sql` | Atomic RPC functions for wallet operations |
| `supabase/migrations/0129_update_confirm_booking_rpc.sql` | Add escrow hold to existing confirm_booking RPC |
| `src/lib/stripe/server.ts` | Server-side Stripe client singleton |
| `src/lib/stripe/config.ts` | Stripe fee calculation and constants |
| `src/app/app/wallet/actions.ts` | Wallet server actions (getWallet, topUp, withdraw, getTransactions) |
| `src/app/app/wallet/page.tsx` | Wallet dashboard page |
| `src/app/app/wallet/top-up/page.tsx` | Full top-up page (alternative to modal) |
| `src/app/app/wallet/withdraw/page.tsx` | Referee withdrawal page |
| `src/components/app/WalletWidget.tsx` | Dashboard wallet card with quick top-up |
| `src/components/app/TopUpModal.tsx` | Top-up modal overlay |
| `src/components/app/WalletBalanceNav.tsx` | Nav bar balance indicator |
| `src/app/api/webhooks/stripe/route.ts` | Stripe webhook handler |
| `src/app/api/cron/escrow-release/route.ts` | Cron job for 18h nudge + 24h release |
| `src/app/app/disputes/actions.ts` | Dispute server actions |
| `src/app/app/disputes/page.tsx` | Admin dispute management page |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add Wallet, WalletTransaction, Dispute types |
| `src/lib/validation.ts` | Add topUp, withdraw, dispute schemas |
| `src/lib/rate-limit.ts` | Add checkTopUpRateLimit, checkWithdrawRateLimit |
| `src/app/app/bookings/actions.ts` | Modify confirmPrice to call new escrow RPC, modify cancelBooking to refund escrow |
| `src/app/app/bookings/[id]/BookingActions.tsx` | Show wallet balance at confirm, insufficient funds inline top-up |
| `src/app/app/page.tsx` | Add WalletWidget to coach and referee dashboards |
| `src/app/app/layout.tsx` | Add WalletBalanceNav to header |
| `package.json` | Add stripe and @stripe/stripe-js dependencies |
| `vercel.json` | Add cron schedule for escrow-release |

---

## Phase 1: Database Foundation

### Task 1: Create wallet tables migration

**Files:**
- Create: `supabase/migrations/0126_wallet_tables.sql`

- [ ] **Step 1: Write the wallets table**

```sql
-- ============================================================================
-- Migration 0126: Wallet & Escrow tables
--
-- Creates the core wallet infrastructure:
-- - wallets: one per user, tracks balance and escrow
-- - wallet_transactions: immutable audit log of all money movements
-- - disputes: for contested escrow releases
-- ============================================================================

-- Enable RLS on all new tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;

-- ============================================================================
-- wallets table
-- ============================================================================
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    balance_pence INTEGER NOT NULL DEFAULT 0 CHECK (balance_pence >= 0),
    escrow_pence INTEGER NOT NULL DEFAULT 0 CHECK (escrow_pence >= 0),
    currency TEXT NOT NULL DEFAULT 'GBP',
    stripe_customer_id TEXT,
    stripe_connect_id TEXT,
    stripe_connect_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wallets_user_id_unique UNIQUE (user_id)
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_stripe_customer_id ON wallets(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_wallets_stripe_connect_id ON wallets(stripe_connect_id) WHERE stripe_connect_id IS NOT NULL;
```

- [ ] **Step 2: Add the wallet_transactions table**

Append to the same file:

```sql
-- ============================================================================
-- wallet_transactions table (immutable audit log)
-- ============================================================================
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'top_up', 'escrow_hold', 'escrow_release', 'escrow_refund',
        'withdrawal', 'platform_fee', 'admin_credit', 'admin_debit'
    )),
    amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    balance_after_pence INTEGER NOT NULL,
    reference_type TEXT CHECK (reference_type IN (
        'booking', 'stripe_checkout', 'stripe_payout', 'admin_action'
    )),
    reference_id TEXT,
    stripe_session_id TEXT,
    stripe_transfer_id TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Indexes for common queries
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX idx_wallet_transactions_stripe_session ON wallet_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- Prevent updates and deletes on transactions (immutable)
CREATE OR REPLACE FUNCTION prevent_transaction_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'wallet_transactions are immutable — updates and deletes are not allowed';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_transactions_immutable_update
    BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION prevent_transaction_mutation();

CREATE TRIGGER wallet_transactions_immutable_delete
    BEFORE DELETE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION prevent_transaction_mutation();
```

- [ ] **Step 3: Add the disputes table**

Append to the same file:

```sql
-- ============================================================================
-- disputes table
-- ============================================================================
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    raised_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'resolved_coach', 'resolved_referee', 'resolved_split'
    )),
    admin_notes TEXT,
    admin_user_id UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT disputes_booking_unique UNIQUE (booking_id)
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_disputes_booking_id ON disputes(booking_id);
CREATE INDEX idx_disputes_status ON disputes(status) WHERE status = 'open';

-- ============================================================================
-- Add escrow tracking columns to bookings
-- ============================================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS escrow_amount_pence INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS escrow_released_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS nudge_sent_at TIMESTAMPTZ;

-- ============================================================================
-- Updated_at trigger for wallets
-- ============================================================================
CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_wallet_updated_at();
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0126_wallet_tables.sql
git commit -m "feat: add wallet, transactions, and disputes tables (migration 0126)"
```

---

### Task 2: Create RLS policies

**Files:**
- Create: `supabase/migrations/0127_wallet_rls.sql`

- [ ] **Step 1: Write wallet RLS policies**

```sql
-- ============================================================================
-- Migration 0127: RLS policies for wallet tables
--
-- Wallets and transactions are read-only for users.
-- All mutations happen via SECURITY DEFINER RPC functions.
-- Admin (role = 'admin') can read all records.
-- ============================================================================

-- ============================================================================
-- wallets policies
-- ============================================================================

-- Users can read their own wallet
CREATE POLICY wallets_select_own ON wallets
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Admin can read all wallets
CREATE POLICY wallets_select_admin ON wallets
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- No direct INSERT/UPDATE/DELETE — handled by RPC functions

-- ============================================================================
-- wallet_transactions policies
-- ============================================================================

-- Users can read their own transactions (via wallet ownership)
CREATE POLICY wallet_transactions_select_own ON wallet_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM wallets
            WHERE wallets.id = wallet_transactions.wallet_id
            AND wallets.user_id = auth.uid()
        )
    );

-- Admin can read all transactions
CREATE POLICY wallet_transactions_select_admin ON wallet_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- No direct INSERT/UPDATE/DELETE — handled by RPC functions
-- (UPDATE/DELETE also blocked by immutability triggers from 0126)

-- ============================================================================
-- disputes policies
-- ============================================================================

-- Users can read disputes for bookings they're involved in
CREATE POLICY disputes_select_involved ON disputes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = disputes.booking_id
            AND (
                bookings.coach_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM booking_assignments
                    WHERE booking_assignments.booking_id = bookings.id
                    AND booking_assignments.referee_id = auth.uid()
                )
            )
        )
    );

-- Users can create disputes for their own bookings
CREATE POLICY disputes_insert_involved ON disputes
    FOR INSERT TO authenticated
    WITH CHECK (
        raised_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = disputes.booking_id
            AND (
                bookings.coach_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM booking_assignments
                    WHERE booking_assignments.booking_id = bookings.id
                    AND booking_assignments.referee_id = auth.uid()
                )
            )
        )
    );

-- Admin can read and update all disputes
CREATE POLICY disputes_select_admin ON disputes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY disputes_update_admin ON disputes
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0127_wallet_rls.sql
git commit -m "feat: add RLS policies for wallet tables (migration 0127)"
```

---

### Task 3: Create wallet RPC functions

**Files:**
- Create: `supabase/migrations/0128_wallet_rpc.sql`

- [ ] **Step 1: Write wallet_top_up RPC**

```sql
-- ============================================================================
-- Migration 0128: Wallet RPC functions
--
-- All wallet mutations happen through these SECURITY DEFINER functions
-- to enforce atomicity and prevent race conditions via SELECT ... FOR UPDATE.
-- ============================================================================

-- ============================================================================
-- wallet_top_up: Credit wallet after Stripe checkout completes
-- Called by webhook handler with service role (not user-facing)
-- ============================================================================
CREATE OR REPLACE FUNCTION wallet_top_up(
    p_user_id UUID,
    p_amount_pence INTEGER,
    p_stripe_session_id TEXT,
    p_description TEXT DEFAULT 'Wallet top-up'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet wallets%ROWTYPE;
    v_new_balance INTEGER;
BEGIN
    -- Validate amount
    IF p_amount_pence <= 0 THEN
        RETURN json_build_object('error', 'Amount must be positive');
    END IF;

    -- Idempotency: check if this Stripe session was already processed
    IF EXISTS (
        SELECT 1 FROM wallet_transactions
        WHERE stripe_session_id = p_stripe_session_id
    ) THEN
        RETURN json_build_object('error', 'This payment has already been processed');
    END IF;

    -- Get or create wallet (with lock)
    SELECT * INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance_pence, escrow_pence)
        VALUES (p_user_id, 0, 0)
        RETURNING * INTO v_wallet;
    END IF;

    -- Credit the wallet
    v_new_balance := v_wallet.balance_pence + p_amount_pence;

    UPDATE wallets
    SET balance_pence = v_new_balance
    WHERE id = v_wallet.id;

    -- Record transaction
    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, stripe_session_id, description
    ) VALUES (
        v_wallet.id, 'top_up', p_amount_pence, 'credit', v_new_balance,
        'stripe_checkout', p_stripe_session_id, p_description
    );

    RETURN json_build_object(
        'success', true,
        'wallet_id', v_wallet.id,
        'new_balance_pence', v_new_balance
    );
END;
$$;
```

- [ ] **Step 2: Write escrow_hold RPC**

Append to the same file:

```sql
-- ============================================================================
-- escrow_hold: Reserve funds from coach wallet for a booking
-- Called during booking confirmation (wraps with confirm_booking logic)
-- ============================================================================
CREATE OR REPLACE FUNCTION escrow_hold(
    p_user_id UUID,
    p_booking_id UUID,
    p_amount_pence INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet wallets%ROWTYPE;
    v_new_balance INTEGER;
    v_new_escrow INTEGER;
BEGIN
    IF p_amount_pence <= 0 THEN
        RETURN json_build_object('error', 'Amount must be positive');
    END IF;

    -- Lock the wallet row to prevent race conditions
    SELECT * INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Wallet not found. Please top up your wallet first.');
    END IF;

    -- Check sufficient balance
    IF v_wallet.balance_pence < p_amount_pence THEN
        RETURN json_build_object(
            'error', 'Insufficient funds',
            'balance_pence', v_wallet.balance_pence,
            'required_pence', p_amount_pence,
            'shortfall_pence', p_amount_pence - v_wallet.balance_pence
        );
    END IF;

    -- Move funds from balance to escrow
    v_new_balance := v_wallet.balance_pence - p_amount_pence;
    v_new_escrow := v_wallet.escrow_pence + p_amount_pence;

    UPDATE wallets
    SET balance_pence = v_new_balance,
        escrow_pence = v_new_escrow
    WHERE id = v_wallet.id;

    -- Record transaction
    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_wallet.id, 'escrow_hold', p_amount_pence, 'debit', v_new_balance,
        'booking', p_booking_id::TEXT,
        'Funds held in escrow for booking'
    );

    -- Tag the booking with escrow amount
    UPDATE bookings
    SET escrow_amount_pence = p_amount_pence
    WHERE id = p_booking_id;

    RETURN json_build_object(
        'success', true,
        'new_balance_pence', v_new_balance,
        'new_escrow_pence', v_new_escrow
    );
END;
$$;
```

- [ ] **Step 3: Write escrow_release RPC**

Append to the same file:

```sql
-- ============================================================================
-- escrow_release: Release escrow funds to referee wallet
-- Called by cron job after 24h or by admin resolution
-- ============================================================================
CREATE OR REPLACE FUNCTION escrow_release(
    p_booking_id UUID,
    p_platform_fee_pence INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking RECORD;
    v_coach_wallet wallets%ROWTYPE;
    v_referee_wallet wallets%ROWTYPE;
    v_referee_amount INTEGER;
    v_new_coach_escrow INTEGER;
    v_new_referee_balance INTEGER;
BEGIN
    -- Get booking with assignment
    SELECT b.id, b.coach_id, b.escrow_amount_pence, b.escrow_released_at,
           ba.referee_id
    INTO v_booking
    FROM bookings b
    JOIN booking_assignments ba ON ba.booking_id = b.id
    WHERE b.id = p_booking_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Booking or assignment not found');
    END IF;

    IF v_booking.escrow_released_at IS NOT NULL THEN
        RETURN json_build_object('error', 'Escrow already released for this booking');
    END IF;

    IF v_booking.escrow_amount_pence IS NULL OR v_booking.escrow_amount_pence <= 0 THEN
        RETURN json_build_object('error', 'No escrow amount on this booking');
    END IF;

    -- Calculate referee payout
    v_referee_amount := v_booking.escrow_amount_pence - p_platform_fee_pence;
    IF v_referee_amount <= 0 THEN
        RETURN json_build_object('error', 'Platform fee exceeds escrow amount');
    END IF;

    -- Lock coach wallet and reduce escrow
    SELECT * INTO v_coach_wallet
    FROM wallets WHERE user_id = v_booking.coach_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Coach wallet not found');
    END IF;

    v_new_coach_escrow := v_coach_wallet.escrow_pence - v_booking.escrow_amount_pence;

    UPDATE wallets
    SET escrow_pence = v_new_coach_escrow
    WHERE id = v_coach_wallet.id;

    -- Record coach escrow release transaction
    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_coach_wallet.id, 'escrow_release', v_booking.escrow_amount_pence, 'debit',
        v_coach_wallet.balance_pence,
        'booking', p_booking_id::TEXT,
        'Escrow released to referee'
    );

    -- Get or create referee wallet (with lock)
    SELECT * INTO v_referee_wallet
    FROM wallets WHERE user_id = v_booking.referee_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance_pence, escrow_pence)
        VALUES (v_booking.referee_id, 0, 0)
        RETURNING * INTO v_referee_wallet;
    END IF;

    v_new_referee_balance := v_referee_wallet.balance_pence + v_referee_amount;

    UPDATE wallets
    SET balance_pence = v_new_referee_balance
    WHERE id = v_referee_wallet.id;

    -- Record referee credit transaction
    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_referee_wallet.id, 'escrow_release', v_referee_amount, 'credit',
        v_new_referee_balance,
        'booking', p_booking_id::TEXT,
        'Payment received for match'
    );

    -- Record platform fee if applicable
    IF p_platform_fee_pence > 0 THEN
        INSERT INTO wallet_transactions (
            wallet_id, type, amount_pence, direction, balance_after_pence,
            reference_type, reference_id, description
        ) VALUES (
            v_coach_wallet.id, 'platform_fee', p_platform_fee_pence, 'debit',
            v_coach_wallet.balance_pence,
            'booking', p_booking_id::TEXT,
            'Platform fee'
        );
    END IF;

    -- Mark booking as released
    UPDATE bookings
    SET escrow_released_at = NOW(),
        status = 'completed'
    WHERE id = p_booking_id;

    RETURN json_build_object(
        'success', true,
        'referee_amount_pence', v_referee_amount,
        'platform_fee_pence', p_platform_fee_pence,
        'booking_id', p_booking_id
    );
END;
$$;
```

- [ ] **Step 4: Write escrow_refund RPC**

Append to the same file:

```sql
-- ============================================================================
-- escrow_refund: Return escrowed funds to coach wallet (cancellation/dispute)
-- ============================================================================
CREATE OR REPLACE FUNCTION escrow_refund(
    p_booking_id UUID,
    p_refund_pence INTEGER DEFAULT NULL -- NULL = full refund
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking RECORD;
    v_wallet wallets%ROWTYPE;
    v_refund_amount INTEGER;
    v_new_balance INTEGER;
    v_new_escrow INTEGER;
BEGIN
    SELECT id, coach_id, escrow_amount_pence, escrow_released_at
    INTO v_booking
    FROM bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Booking not found');
    END IF;

    IF v_booking.escrow_released_at IS NOT NULL THEN
        RETURN json_build_object('error', 'Escrow already released — cannot refund');
    END IF;

    IF v_booking.escrow_amount_pence IS NULL OR v_booking.escrow_amount_pence <= 0 THEN
        RETURN json_build_object('error', 'No escrow to refund');
    END IF;

    -- Default to full refund
    v_refund_amount := COALESCE(p_refund_pence, v_booking.escrow_amount_pence);

    IF v_refund_amount > v_booking.escrow_amount_pence THEN
        RETURN json_build_object('error', 'Refund exceeds escrow amount');
    END IF;

    -- Lock coach wallet
    SELECT * INTO v_wallet
    FROM wallets WHERE user_id = v_booking.coach_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Coach wallet not found');
    END IF;

    v_new_balance := v_wallet.balance_pence + v_refund_amount;
    v_new_escrow := v_wallet.escrow_pence - v_refund_amount;

    UPDATE wallets
    SET balance_pence = v_new_balance,
        escrow_pence = v_new_escrow
    WHERE id = v_wallet.id;

    -- Record transaction
    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_wallet.id, 'escrow_refund', v_refund_amount, 'credit', v_new_balance,
        'booking', p_booking_id::TEXT,
        'Escrow refunded — booking cancelled'
    );

    -- Clear escrow from booking
    UPDATE bookings
    SET escrow_amount_pence = CASE
        WHEN v_refund_amount = v_booking.escrow_amount_pence THEN NULL
        ELSE v_booking.escrow_amount_pence - v_refund_amount
    END
    WHERE id = p_booking_id;

    RETURN json_build_object(
        'success', true,
        'refunded_pence', v_refund_amount,
        'new_balance_pence', v_new_balance
    );
END;
$$;

-- ============================================================================
-- wallet_withdraw: Deduct from wallet for payout (coach or referee)
-- Called by server action after initiating Stripe transfer/refund
-- ============================================================================
CREATE OR REPLACE FUNCTION wallet_withdraw(
    p_user_id UUID,
    p_amount_pence INTEGER,
    p_stripe_transfer_id TEXT,
    p_description TEXT DEFAULT 'Withdrawal to bank account'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet wallets%ROWTYPE;
    v_new_balance INTEGER;
BEGIN
    IF p_amount_pence <= 0 THEN
        RETURN json_build_object('error', 'Amount must be positive');
    END IF;

    -- Lock wallet
    SELECT * INTO v_wallet
    FROM wallets WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Wallet not found');
    END IF;

    IF v_wallet.balance_pence < p_amount_pence THEN
        RETURN json_build_object('error', 'Insufficient funds');
    END IF;

    v_new_balance := v_wallet.balance_pence - p_amount_pence;

    UPDATE wallets
    SET balance_pence = v_new_balance
    WHERE id = v_wallet.id;

    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, stripe_transfer_id, description
    ) VALUES (
        v_wallet.id, 'withdrawal', p_amount_pence, 'debit', v_new_balance,
        'stripe_payout', p_stripe_transfer_id, p_description
    );

    RETURN json_build_object(
        'success', true,
        'new_balance_pence', v_new_balance
    );
END;
$$;

-- ============================================================================
-- admin_wallet_adjustment: Credit or debit any wallet (admin override)
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_wallet_adjustment(
    p_target_user_id UUID,
    p_amount_pence INTEGER,
    p_direction TEXT, -- 'credit' or 'debit'
    p_admin_notes TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet wallets%ROWTYPE;
    v_new_balance INTEGER;
    v_type TEXT;
BEGIN
    IF p_amount_pence <= 0 THEN
        RETURN json_build_object('error', 'Amount must be positive');
    END IF;

    IF p_direction NOT IN ('credit', 'debit') THEN
        RETURN json_build_object('error', 'Direction must be credit or debit');
    END IF;

    IF p_admin_notes IS NULL OR length(p_admin_notes) < 5 THEN
        RETURN json_build_object('error', 'Admin notes are required (min 5 characters)');
    END IF;

    SELECT * INTO v_wallet
    FROM wallets WHERE user_id = p_target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Wallet not found for this user');
    END IF;

    IF p_direction = 'credit' THEN
        v_new_balance := v_wallet.balance_pence + p_amount_pence;
        v_type := 'admin_credit';
    ELSE
        IF v_wallet.balance_pence < p_amount_pence THEN
            RETURN json_build_object(
                'error', 'Insufficient balance for debit',
                'available_pence', v_wallet.balance_pence
            );
        END IF;
        v_new_balance := v_wallet.balance_pence - p_amount_pence;
        v_type := 'admin_debit';
    END IF;

    UPDATE wallets
    SET balance_pence = v_new_balance
    WHERE id = v_wallet.id;

    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, description
    ) VALUES (
        v_wallet.id, v_type, p_amount_pence, p_direction, v_new_balance,
        'admin_action', p_admin_notes
    );

    RETURN json_build_object(
        'success', true,
        'new_balance_pence', v_new_balance
    );
END;
$$;

-- ============================================================================
-- Grant execute to authenticated users
-- ============================================================================
GRANT EXECUTE ON FUNCTION wallet_top_up(UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION escrow_hold(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION escrow_release(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION escrow_refund(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION wallet_withdraw(UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_wallet_adjustment(UUID, INTEGER, TEXT, TEXT) TO authenticated;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0128_wallet_rpc.sql
git commit -m "feat: add wallet RPC functions — top_up, escrow_hold, escrow_release, escrow_refund (migration 0128)"
```

---

### Task 4: Update confirm_booking RPC to include escrow

**Files:**
- Create: `supabase/migrations/0129_update_confirm_booking_rpc.sql`

- [ ] **Step 1: Write the updated RPC**

```sql
-- ============================================================================
-- Migration 0129: Update confirm_booking to include escrow hold
--
-- Replaces the existing confirm_booking RPC to add wallet balance check
-- and escrow hold as part of the atomic booking confirmation.
-- ============================================================================

CREATE OR REPLACE FUNCTION confirm_booking(p_offer_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_id UUID;
    v_referee_id UUID;
    v_coach_id UUID;
    v_offer_status TEXT;
    v_price_pence INTEGER;
    v_wallet wallets%ROWTYPE;
    v_new_balance INTEGER;
    v_new_escrow INTEGER;
BEGIN
    -- 1. Get and validate the offer
    SELECT booking_id, referee_id, status, price_pence
    INTO v_booking_id, v_referee_id, v_offer_status, v_price_pence
    FROM booking_offers
    WHERE id = p_offer_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Offer not found');
    END IF;

    IF v_offer_status != 'accepted_priced' THEN
        RETURN json_build_object('error', 'Offer is not in accepted_priced status');
    END IF;

    IF v_price_pence IS NULL OR v_price_pence <= 0 THEN
        RETURN json_build_object('error', 'Offer has no valid price');
    END IF;

    -- 2. Verify the booking exists and get coach_id
    SELECT coach_id INTO v_coach_id
    FROM bookings
    WHERE id = v_booking_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Booking not found');
    END IF;

    -- Verify the calling user is the coach
    IF v_coach_id != auth.uid() THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    -- 3. ESCROW: Lock wallet and check balance
    SELECT * INTO v_wallet
    FROM wallets
    WHERE user_id = v_coach_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'error', 'No wallet found. Please top up your wallet before confirming.',
            'code', 'NO_WALLET'
        );
    END IF;

    IF v_wallet.balance_pence < v_price_pence THEN
        RETURN json_build_object(
            'error', 'Insufficient funds',
            'code', 'INSUFFICIENT_FUNDS',
            'balance_pence', v_wallet.balance_pence,
            'required_pence', v_price_pence,
            'shortfall_pence', v_price_pence - v_wallet.balance_pence
        );
    END IF;

    -- 4. ESCROW: Move funds from balance to escrow
    v_new_balance := v_wallet.balance_pence - v_price_pence;
    v_new_escrow := v_wallet.escrow_pence + v_price_pence;

    UPDATE wallets
    SET balance_pence = v_new_balance,
        escrow_pence = v_new_escrow
    WHERE id = v_wallet.id;

    -- Record escrow transaction
    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_wallet.id, 'escrow_hold', v_price_pence, 'debit', v_new_balance,
        'booking', v_booking_id::TEXT,
        'Funds held in escrow for booking confirmation'
    );

    -- 5. Original atomic transaction: accept offer → create assignment → confirm booking
    UPDATE booking_offers
    SET status = 'accepted'
    WHERE id = p_offer_id;

    INSERT INTO booking_assignments (booking_id, referee_id)
    VALUES (v_booking_id, v_referee_id);

    UPDATE bookings
    SET status = 'confirmed',
        escrow_amount_pence = v_price_pence
    WHERE id = v_booking_id;

    RETURN json_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'referee_id', v_referee_id,
        'escrow_amount_pence', v_price_pence,
        'wallet_balance_pence', v_new_balance
    );
END;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0129_update_confirm_booking_rpc.sql
git commit -m "feat: update confirm_booking RPC with escrow hold (migration 0129)"
```

---

## Phase 2: Stripe Setup & Types

### Task 5: Install Stripe and add types

**Files:**
- Modify: `package.json`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/validation.ts`
- Modify: `src/lib/rate-limit.ts`

- [ ] **Step 1: Install Stripe packages**

```bash
npm install stripe @stripe/stripe-js
```

- [ ] **Step 2: Add wallet types to `src/lib/types.ts`**

Add the following after the existing type definitions (after the last export):

```typescript
// ============================================================================
// Wallet & Escrow Types
// ============================================================================

export type WalletTransactionType =
    | 'top_up'
    | 'escrow_hold'
    | 'escrow_release'
    | 'escrow_refund'
    | 'withdrawal'
    | 'platform_fee'
    | 'admin_credit'
    | 'admin_debit'

export type WalletTransactionDirection = 'credit' | 'debit'

export type DisputeStatus = 'open' | 'resolved_coach' | 'resolved_referee' | 'resolved_split'

export interface Wallet {
    id: string
    user_id: string
    balance_pence: number
    escrow_pence: number
    currency: string
    stripe_customer_id: string | null
    stripe_connect_id: string | null
    stripe_connect_onboarded: boolean
    created_at: string
    updated_at: string
}

export interface WalletTransaction {
    id: string
    wallet_id: string
    type: WalletTransactionType
    amount_pence: number
    direction: WalletTransactionDirection
    balance_after_pence: number
    reference_type: string | null
    reference_id: string | null
    stripe_session_id: string | null
    stripe_transfer_id: string | null
    description: string | null
    created_at: string
}

export interface Dispute {
    id: string
    booking_id: string
    raised_by: string
    reason: string
    status: DisputeStatus
    admin_notes: string | null
    admin_user_id: string | null
    resolved_at: string | null
    created_at: string
}
```

- [ ] **Step 3: Add validation schemas to `src/lib/validation.ts`**

Add after the existing schemas:

```typescript
export const topUpSchema = z.object({
    amountPounds: z.number().min(5, 'Minimum top-up is £5').max(500, 'Maximum top-up is £500'),
})

export const withdrawSchema = z.object({
    amountPounds: z.number().min(5, 'Minimum withdrawal is £5').max(10000, 'Maximum withdrawal is £10,000'),
})

export const disputeSchema = z.object({
    bookingId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid booking ID'),
    reason: z.string().min(10, 'Please provide at least 10 characters explaining the issue').max(1000),
})
```

- [ ] **Step 4: Add rate limits to `src/lib/rate-limit.ts`**

Add after the existing rate limit functions (follow the same pattern as `checkConfirmRateLimit`):

```typescript
export function checkTopUpRateLimit(userId: string): string | null {
    return checkRateLimit(`topup:${userId}`, 5, 60 * 1000) // 5 per minute
}

export function checkWithdrawRateLimit(userId: string): string | null {
    return checkRateLimit(`withdraw:${userId}`, 3, 60 * 1000) // 3 per minute
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/types.ts src/lib/validation.ts src/lib/rate-limit.ts
git commit -m "feat: add Stripe SDK, wallet types, validation schemas, and rate limits"
```

---

### Task 6: Create Stripe server utilities

**Files:**
- Create: `src/lib/stripe/server.ts`
- Create: `src/lib/stripe/config.ts`

- [ ] **Step 1: Create Stripe server client**

```typescript
// src/lib/stripe/server.ts
import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
    if (!stripeInstance) {
        const key = process.env.STRIPE_SECRET_KEY
        if (!key) {
            throw new Error('STRIPE_SECRET_KEY is not set')
        }
        stripeInstance = new Stripe(key, {
            apiVersion: '2025-04-30.basil',
            typescript: true,
        })
    }
    return stripeInstance
}
```

- [ ] **Step 2: Create Stripe config with fee calculation**

```typescript
// src/lib/stripe/config.ts

// Stripe UK card fees (as of 2026): 1.5% + 20p for UK cards, 2.5% + 20p for EU
// We over-estimate slightly to ensure the coach gets the full amount credited
const STRIPE_PERCENTAGE = 0.025 // 2.5% to cover worst case (EU cards)
const STRIPE_FIXED_PENCE = 20

export const STRIPE_CONFIG = {
    MIN_TOP_UP_POUNDS: 5,
    MAX_TOP_UP_POUNDS: 500,
    MIN_WITHDRAWAL_POUNDS: 5,
    CURRENCY: 'gbp' as const,
}

/**
 * Calculate what to charge the coach so their wallet receives exactly `desiredPence`.
 * Formula: charge = (desired + fixed) / (1 - percentage)
 * Rounds up to nearest penny to ensure we never under-charge.
 */
export function calculateChargeAmount(desiredPence: number): {
    chargePence: number
    estimatedFeePence: number
} {
    const chargeRaw = (desiredPence + STRIPE_FIXED_PENCE) / (1 - STRIPE_PERCENTAGE)
    const chargePence = Math.ceil(chargeRaw)
    const estimatedFeePence = chargePence - desiredPence

    return { chargePence, estimatedFeePence }
}

/**
 * After Stripe processes the payment, calculate the actual wallet credit.
 * charge_amount - actual_stripe_fee = what the coach gets in their wallet.
 */
export function calculateWalletCredit(chargePence: number, actualFeePence: number): number {
    return chargePence - actualFeePence
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/stripe/server.ts src/lib/stripe/config.ts
git commit -m "feat: add Stripe server client and fee calculation utilities"
```

---

## Phase 3: Wallet Server Actions

### Task 7: Core wallet actions

**Files:**
- Create: `src/app/app/wallet/actions.ts`

- [ ] **Step 1: Write getWallet and getTransactions actions**

```typescript
// src/app/app/wallet/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getStripe } from '@/lib/stripe/server'
import { calculateChargeAmount, STRIPE_CONFIG } from '@/lib/stripe/config'
import { validate } from '@/lib/validation'
import { topUpSchema, withdrawSchema } from '@/lib/validation'
import { checkTopUpRateLimit, checkWithdrawRateLimit } from '@/lib/rate-limit'
import type { Wallet, WalletTransaction } from '@/lib/types'

export async function getWallet(): Promise<{ data?: Wallet; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

    if (error) {
        return { error: error.message }
    }

    // Return null wallet if none exists yet (coach hasn't topped up)
    return { data: data ?? undefined }
}

export async function getTransactions(
    limit = 20,
    offset = 0
): Promise<{ data?: WalletTransaction[]; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Get wallet first
    const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (!wallet) {
        return { data: [] }
    }

    const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (error) {
        return { error: error.message }
    }

    return { data: data ?? [] }
}
```

- [ ] **Step 2: Write createTopUpSession action**

Append to the same file:

```typescript
export async function createTopUpSession(amountPounds: number): Promise<{
    url?: string
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const rateLimitError = checkTopUpRateLimit(user.id)
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    const validationError = validate(topUpSchema, { amountPounds })
    if (validationError) {
        return { error: validationError }
    }

    const desiredPence = Math.round(amountPounds * 100)
    const { chargePence } = calculateChargeAmount(desiredPence)

    // Ensure coach has a Stripe customer ID
    let { data: wallet } = await supabase
        .from('wallets')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle()

    const stripe = getStripe()
    let stripeCustomerId = wallet?.stripe_customer_id

    if (!stripeCustomerId) {
        // Get user profile for email
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .single()

        const customer = await stripe.customers.create({
            email: profile?.email ?? user.email,
            name: profile?.full_name ?? undefined,
            metadata: { supabase_user_id: user.id },
        })

        stripeCustomerId = customer.id

        // Upsert wallet with customer ID
        await supabase.from('wallets').upsert({
            user_id: user.id,
            stripe_customer_id: stripeCustomerId,
            balance_pence: 0,
            escrow_pence: 0,
        }, { onConflict: 'user_id' })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'payment',
        currency: STRIPE_CONFIG.CURRENCY,
        line_items: [{
            price_data: {
                currency: STRIPE_CONFIG.CURRENCY,
                product_data: {
                    name: `Wallet Top-Up — £${amountPounds.toFixed(2)}`,
                    description: `Add £${amountPounds.toFixed(2)} to your Whistle Connect wallet`,
                },
                unit_amount: chargePence,
            },
            quantity: 1,
        }],
        metadata: {
            supabase_user_id: user.id,
            desired_amount_pence: desiredPence.toString(),
            type: 'wallet_top_up',
        },
        success_url: `${siteUrl}/app/wallet?topup=success`,
        cancel_url: `${siteUrl}/app/wallet?topup=cancelled`,
    })

    return { url: session.url ?? undefined }
}
```

- [ ] **Step 3: Write requestWithdrawal action**

Append to the same file:

```typescript
export async function requestWithdrawal(amountPounds: number): Promise<{
    success?: boolean
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const rateLimitError = checkWithdrawRateLimit(user.id)
    if (rateLimitError) {
        return { error: rateLimitError }
    }

    const validationError = validate(withdrawSchema, { amountPounds })
    if (validationError) {
        return { error: validationError }
    }

    const amountPence = Math.round(amountPounds * 100)

    // Get wallet with Stripe Connect info
    const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single()

    if (!wallet) {
        return { error: 'No wallet found' }
    }

    if (!wallet.stripe_connect_id || !wallet.stripe_connect_onboarded) {
        return { error: 'Please complete Stripe onboarding before withdrawing' }
    }

    if (wallet.balance_pence < amountPence) {
        return { error: 'Insufficient funds for withdrawal' }
    }

    // Create Stripe Transfer to connected account
    const stripe = getStripe()

    try {
        const transfer = await stripe.transfers.create({
            amount: amountPence,
            currency: STRIPE_CONFIG.CURRENCY,
            destination: wallet.stripe_connect_id,
            metadata: {
                supabase_user_id: user.id,
                wallet_id: wallet.id,
                type: 'referee_withdrawal',
            },
        })

        // Deduct from wallet atomically via RPC
        const { data: result, error: rpcError } = await supabase.rpc('wallet_withdraw', {
            p_user_id: user.id,
            p_amount_pence: amountPence,
            p_stripe_transfer_id: transfer.id,
            p_description: `Withdrawal of £${amountPounds.toFixed(2)} to bank account`,
        })

        if (rpcError || result?.error) {
            // Transfer was created but wallet deduction failed — log for admin
            console.error('Wallet withdraw RPC failed after Stripe transfer:', rpcError || result?.error)
            return { error: 'Withdrawal partially processed. Please contact support.' }
        }

        revalidatePath('/app/wallet')
        return { success: true }
    } catch (err) {
        console.error('Stripe transfer failed:', err)
        return { error: 'Withdrawal failed. Please try again later.' }
    }
}
```

- [ ] **Step 4: Write createStripeConnectLink action**

Append to the same file:

```typescript
export async function createStripeConnectLink(): Promise<{
    url?: string
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const stripe = getStripe()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // Get or create connected account
    let { data: wallet } = await supabase
        .from('wallets')
        .select('stripe_connect_id')
        .eq('user_id', user.id)
        .maybeSingle()

    let connectId = wallet?.stripe_connect_id

    if (!connectId) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', user.id)
            .single()

        const account = await stripe.accounts.create({
            type: 'express',
            country: 'GB',
            email: profile?.email ?? user.email,
            capabilities: {
                transfers: { requested: true },
            },
            metadata: { supabase_user_id: user.id },
        })

        connectId = account.id

        // Upsert wallet with connect ID
        const { createAdminClient } = await import('@/lib/supabase/server')
        const adminSupabase = createAdminClient()

        await adminSupabase.from('wallets').upsert({
            user_id: user.id,
            stripe_connect_id: connectId,
            balance_pence: 0,
            escrow_pence: 0,
        }, { onConflict: 'user_id' })
    }

    const accountLink = await stripe.accountLinks.create({
        account: connectId,
        refresh_url: `${siteUrl}/app/wallet/withdraw?connect=refresh`,
        return_url: `${siteUrl}/app/wallet/withdraw?connect=complete`,
        type: 'account_onboarding',
    })

    return { url: accountLink.url }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/app/wallet/actions.ts
git commit -m "feat: add wallet server actions — getWallet, topUp, withdraw, Stripe Connect"
```

---

### Task 8: Stripe webhook endpoint

**Files:**
- Create: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Write the webhook handler**

```typescript
// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    const stripe = getStripe()
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET is not set')
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
                break

            case 'account.updated':
                await handleAccountUpdated(event.data.object as Stripe.Account)
                break

            case 'transfer.failed':
                await handleTransferFailed(event.data.object as Stripe.Transfer)
                break

            default:
                // Ignore unhandled events
                break
        }

        return NextResponse.json({ received: true })
    } catch (err) {
        console.error(`Webhook handler error for ${event.type}:`, err)
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
    }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.metadata?.type !== 'wallet_top_up') {
        return // Not a wallet top-up session
    }

    const userId = session.metadata.supabase_user_id
    const desiredAmountPence = parseInt(session.metadata.desired_amount_pence, 10)

    if (!userId || isNaN(desiredAmountPence)) {
        console.error('Invalid metadata on checkout session:', session.id)
        return
    }

    // Calculate actual credit: what was charged minus Stripe's actual fee
    // For simplicity and accuracy, credit the desired amount (we over-charged to cover fees)
    const creditPence = desiredAmountPence

    const supabase = createAdminClient()

    const { data: result, error } = await supabase.rpc('wallet_top_up', {
        p_user_id: userId,
        p_amount_pence: creditPence,
        p_stripe_session_id: session.id,
        p_description: `Wallet top-up: £${(creditPence / 100).toFixed(2)}`,
    })

    if (error) {
        console.error('wallet_top_up RPC failed:', error)
        throw error
    }

    if (result?.error) {
        // Idempotency: "already processed" is not an error
        if (result.error === 'This payment has already been processed') {
            return
        }
        console.error('wallet_top_up returned error:', result.error)
        throw new Error(result.error)
    }
}

async function handleAccountUpdated(account: Stripe.Account) {
    const userId = account.metadata?.supabase_user_id
    if (!userId) return

    const isOnboarded = account.charges_enabled && account.payouts_enabled

    const supabase = createAdminClient()

    await supabase
        .from('wallets')
        .update({ stripe_connect_onboarded: isOnboarded })
        .eq('stripe_connect_id', account.id)
}

async function handleTransferFailed(transfer: Stripe.Transfer) {
    const userId = transfer.metadata?.supabase_user_id
    console.error('Stripe transfer failed:', {
        transferId: transfer.id,
        userId,
        amount: transfer.amount,
    })

    // Create an admin notification about the failed transfer
    if (userId) {
        const supabase = createAdminClient()

        // Find admin users to notify
        const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin')

        if (admins) {
            for (const admin of admins) {
                await supabase.from('notifications').insert({
                    user_id: admin.id,
                    title: 'Transfer Failed',
                    message: `Stripe transfer ${transfer.id} failed for user ${userId}. Amount: £${(transfer.amount / 100).toFixed(2)}`,
                    type: 'error',
                    link: '/app/admin',
                })
            }
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat: add Stripe webhook endpoint for checkout, account updates, and transfer failures"
```

---

## Phase 4: Booking Flow Integration

### Task 9: Modify confirmPrice to use new escrow RPC

**Files:**
- Modify: `src/app/app/bookings/actions.ts:595-640`

- [ ] **Step 1: Update the confirmPrice function**

The existing `confirmPrice` function calls `supabase.rpc('confirm_booking', ...)`. Since we updated the RPC in migration 0129 to include escrow, the function signature stays the same. But we need to handle the new error codes.

In `src/app/app/bookings/actions.ts`, find the confirmPrice function. Replace the RPC call and error handling section (approximately lines 629-644):

Find this block:
```typescript
    const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_booking', {
        p_offer_id: offerId,
    })

    if (rpcError) {
        return { error: 'Failed to confirm booking: ' + rpcError.message }
    }

    if (rpcResult?.error) {
        return { error: rpcResult.error }
    }
```

Replace with:
```typescript
    const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_booking', {
        p_offer_id: offerId,
    })

    if (rpcError) {
        return { error: 'Failed to confirm booking: ' + rpcError.message }
    }

    if (rpcResult?.error) {
        // Pass through structured wallet errors for UI handling
        if (rpcResult.code === 'INSUFFICIENT_FUNDS') {
            return {
                error: 'Insufficient funds',
                code: 'INSUFFICIENT_FUNDS',
                balancePence: rpcResult.balance_pence,
                requiredPence: rpcResult.required_pence,
                shortfallPence: rpcResult.shortfall_pence,
            }
        }
        if (rpcResult.code === 'NO_WALLET') {
            return {
                error: 'Please top up your wallet before confirming a booking.',
                code: 'NO_WALLET',
            }
        }
        return { error: rpcResult.error }
    }
```

- [ ] **Step 2: Add wallet revalidation path**

In the same function, find the revalidatePath calls at the end and add:

```typescript
    revalidatePath('/app/wallet')
```

- [ ] **Step 3: Commit**

```bash
git add src/app/app/bookings/actions.ts
git commit -m "feat: update confirmPrice to handle escrow error codes from updated RPC"
```

---

### Task 10: Modify cancelBooking to refund escrow

**Files:**
- Modify: `src/app/app/bookings/actions.ts` (cancelBooking function, approximately lines 148-200)

- [ ] **Step 1: Add escrow refund to cancelBooking**

Find the `cancelBooking` function. After the booking status is updated to 'cancelled', add escrow refund logic. Find the line that updates the booking status:

```typescript
    const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)
```

After this block (and its error check), add:

```typescript
    // Refund escrow if funds were held for this booking
    if (booking.escrow_amount_pence && booking.escrow_amount_pence > 0 && !booking.escrow_released_at) {
        const { data: refundResult, error: refundError } = await supabase.rpc('escrow_refund', {
            p_booking_id: bookingId,
        })

        if (refundError) {
            console.error('Escrow refund failed:', refundError)
            // Don't fail the cancellation — log for admin review
        } else if (refundResult?.error) {
            console.error('Escrow refund returned error:', refundResult.error)
        }
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/app/bookings/actions.ts
git commit -m "feat: refund escrow on booking cancellation"
```

---

### Task 11: Update BookingActions to show wallet balance

**Files:**
- Modify: `src/app/app/bookings/[id]/BookingActions.tsx` (lines 253-319, the coach-with-priced-offer scenario)

- [ ] **Step 1: Add wallet balance fetch**

At the top of the BookingActions component file, add the import and state for wallet:

```typescript
import { getWallet } from '@/app/app/wallet/actions'
```

In the component, add state for wallet data:

```typescript
const [walletBalance, setWalletBalance] = useState<number | null>(null)
const [walletLoading, setWalletLoading] = useState(true)
```

Add a useEffect to fetch wallet balance when the component mounts:

```typescript
useEffect(() => {
    async function fetchWallet() {
        const { data } = await getWallet()
        setWalletBalance(data?.balance_pence ?? 0)
        setWalletLoading(false)
    }
    fetchWallet()
}, [])
```

- [ ] **Step 2: Update the confirm price UI section**

In the coach-with-priced-offer section (Scenario 2, around lines 253-319), find the "Accept Price & Confirm Booking" button. Add wallet balance display and insufficient funds handling.

Before the button, add:

```tsx
{!walletLoading && walletBalance !== null && (
    <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Wallet balance:</span>
        <span className={walletBalance < (offer.price_pence ?? 0) ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
            £{(walletBalance / 100).toFixed(2)}
        </span>
    </div>
)}

{!walletLoading && walletBalance !== null && walletBalance < (offer.price_pence ?? 0) && (
    <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm">
        <p className="text-red-700 dark:text-red-400 font-medium">
            Insufficient funds — you need £{(((offer.price_pence ?? 0) - walletBalance) / 100).toFixed(2)} more
        </p>
        <a
            href={`/app/wallet/top-up?amount=${Math.ceil(((offer.price_pence ?? 0) - walletBalance) / 100)}`}
            className="mt-2 inline-block text-blue-600 dark:text-blue-400 underline"
        >
            Top up your wallet
        </a>
    </div>
)}
```

Disable the confirm button when funds are insufficient:

```tsx
disabled={loading || walletLoading || (walletBalance !== null && walletBalance < (offer.price_pence ?? 0))}
```

- [ ] **Step 3: Handle structured error responses**

In the confirm price handler function, update the error handling to detect wallet errors:

```typescript
const result = await confirmPrice(offer.id)
if (result.error) {
    if (result.code === 'INSUFFICIENT_FUNDS' || result.code === 'NO_WALLET') {
        // Refresh wallet balance to show updated state
        const { data } = await getWallet()
        setWalletBalance(data?.balance_pence ?? 0)
    }
    toast.error(result.error)
    return
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/app/bookings/[id]/BookingActions.tsx
git commit -m "feat: show wallet balance and insufficient funds warning on booking confirmation"
```

---

## Phase 5: Wallet UI

### Task 12: Wallet dashboard page

**Files:**
- Create: `src/app/app/wallet/page.tsx`

- [ ] **Step 1: Write the wallet page**

```tsx
// src/app/app/wallet/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getWallet, getTransactions } from './actions'
import Link from 'next/link'

export default async function WalletPage({
    searchParams,
}: {
    searchParams: Promise<{ topup?: string }>
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const { data: wallet } = await getWallet()
    const { data: transactions } = await getTransactions(50)

    const params = await searchParams
    const topupStatus = params.topup

    const isCoach = profile?.role === 'coach'
    const isReferee = profile?.role === 'referee'

    return (
        <div className="mx-auto max-w-2xl space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Wallet</h1>
                <Link href="/app" className="text-sm text-muted-foreground hover:underline">
                    ← Back to Dashboard
                </Link>
            </div>

            {topupStatus === 'success' && (
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
                    <p className="text-green-700 dark:text-green-400 font-medium">
                        Top-up successful! Your balance has been updated.
                    </p>
                </div>
            )}

            {topupStatus === 'cancelled' && (
                <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-4">
                    <p className="text-yellow-700 dark:text-yellow-400">
                        Top-up was cancelled. No charges were made.
                    </p>
                </div>
            )}

            {/* Balance Card */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Available Balance</p>
                        <p className="text-3xl font-bold">
                            £{((wallet?.balance_pence ?? 0) / 100).toFixed(2)}
                        </p>
                    </div>
                    {isCoach && (
                        <div>
                            <p className="text-sm text-muted-foreground">Held in Escrow</p>
                            <p className="text-3xl font-bold text-amber-600">
                                £{((wallet?.escrow_pence ?? 0) / 100).toFixed(2)}
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-4 flex gap-3">
                    {isCoach && (
                        <Link
                            href="/app/wallet/top-up"
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            Add Funds
                        </Link>
                    )}
                    {isReferee && (
                        <Link
                            href="/app/wallet/withdraw"
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            Withdraw
                        </Link>
                    )}
                </div>
            </div>

            {/* Transaction History */}
            <div className="rounded-xl border bg-card shadow-sm">
                <div className="border-b p-4">
                    <h2 className="text-lg font-semibold">Transaction History</h2>
                </div>

                {(!transactions || transactions.length === 0) ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <p>No transactions yet.</p>
                        {isCoach && (
                            <p className="mt-1 text-sm">Add funds to get started.</p>
                        )}
                    </div>
                ) : (
                    <ul className="divide-y">
                        {transactions.map((tx) => (
                            <li key={tx.id} className="flex items-center justify-between p-4">
                                <div>
                                    <p className="font-medium text-sm">
                                        {formatTransactionType(tx.type)}
                                    </p>
                                    {tx.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {tx.description}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(tx.created_at).toLocaleDateString('en-GB', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                                <span className={`font-semibold ${
                                    tx.direction === 'credit'
                                        ? 'text-green-600'
                                        : 'text-red-500'
                                }`}>
                                    {tx.direction === 'credit' ? '+' : '-'}
                                    £{(tx.amount_pence / 100).toFixed(2)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

function formatTransactionType(type: string): string {
    const labels: Record<string, string> = {
        top_up: 'Wallet Top-Up',
        escrow_hold: 'Escrow Hold',
        escrow_release: 'Payment Released',
        escrow_refund: 'Escrow Refund',
        withdrawal: 'Withdrawal',
        platform_fee: 'Platform Fee',
        admin_credit: 'Admin Credit',
        admin_debit: 'Admin Debit',
    }
    return labels[type] ?? type
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/app/wallet/page.tsx
git commit -m "feat: add wallet dashboard page with balance, escrow, and transaction history"
```

---

### Task 13: Top-up page

**Files:**
- Create: `src/app/app/wallet/top-up/page.tsx`

- [ ] **Step 1: Write the top-up page**

```tsx
// src/app/app/wallet/top-up/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTopUpSession } from '../actions'
import { calculateChargeAmount } from '@/lib/stripe/config'
import Link from 'next/link'

const PRESET_AMOUNTS = [10, 20, 50]

export default function TopUpPage() {
    const router = useRouter()
    const [amount, setAmount] = useState<number | null>(null)
    const [customAmount, setCustomAmount] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const effectiveAmount = amount ?? (customAmount ? parseFloat(customAmount) : null)
    const isValid = effectiveAmount !== null && effectiveAmount >= 5 && effectiveAmount <= 500

    const feeInfo = effectiveAmount && effectiveAmount >= 5
        ? calculateChargeAmount(Math.round(effectiveAmount * 100))
        : null

    async function handleSubmit() {
        if (!effectiveAmount || !isValid) return

        setLoading(true)
        setError(null)

        const result = await createTopUpSession(effectiveAmount)

        if (result.error) {
            setError(result.error)
            setLoading(false)
            return
        }

        if (result.url) {
            window.location.href = result.url
        }
    }

    return (
        <div className="mx-auto max-w-md space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Add Funds</h1>
                <Link href="/app/wallet" className="text-sm text-muted-foreground hover:underline">
                    ← Back
                </Link>
            </div>

            {/* Preset amounts */}
            <div className="grid grid-cols-3 gap-3">
                {PRESET_AMOUNTS.map((preset) => (
                    <button
                        key={preset}
                        onClick={() => { setAmount(preset); setCustomAmount('') }}
                        className={`rounded-lg border-2 p-4 text-center font-semibold transition ${
                            amount === preset
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/50'
                        }`}
                    >
                        £{preset}
                    </button>
                ))}
            </div>

            {/* Custom amount */}
            <div>
                <label className="text-sm font-medium text-muted-foreground">
                    Or enter custom amount
                </label>
                <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                    <input
                        type="number"
                        min="5"
                        max="500"
                        step="0.01"
                        value={customAmount}
                        onChange={(e) => { setCustomAmount(e.target.value); setAmount(null) }}
                        placeholder="5.00 — 500.00"
                        className="w-full rounded-lg border bg-background py-3 pl-8 pr-4 text-lg"
                    />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Minimum £5, maximum £500</p>
            </div>

            {/* Fee breakdown */}
            {feeInfo && isValid && (
                <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
                    <div className="flex justify-between">
                        <span>Wallet credit</span>
                        <span>£{effectiveAmount!.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>Processing fee</span>
                        <span>~£{(feeInfo.estimatedFeePence / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                        <span>You pay</span>
                        <span>£{(feeInfo.chargePence / 100).toFixed(2)}</span>
                    </div>
                </div>
            )}

            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}

            <button
                onClick={handleSubmit}
                disabled={!isValid || loading}
                className="w-full rounded-lg bg-primary py-3 text-center font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Redirecting to payment...' : 'Proceed to Payment'}
            </button>
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/app/wallet/top-up/page.tsx
git commit -m "feat: add top-up page with preset amounts, custom input, and fee preview"
```

---

### Task 14: Withdraw page

**Files:**
- Create: `src/app/app/wallet/withdraw/page.tsx`

- [ ] **Step 1: Write the withdrawal page**

```tsx
// src/app/app/wallet/withdraw/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { getWallet, requestWithdrawal, createStripeConnectLink } from '../actions'
import Link from 'next/link'
import type { Wallet } from '@/lib/types'

export default function WithdrawPage() {
    const [wallet, setWallet] = useState<Wallet | null>(null)
    const [loading, setLoading] = useState(true)
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        async function load() {
            const { data } = await getWallet()
            setWallet(data ?? null)
            setLoading(false)
        }
        load()
    }, [])

    const amount = parseFloat(withdrawAmount)
    const isValid = !isNaN(amount) && amount >= 5 && amount <= (wallet?.balance_pence ?? 0) / 100

    async function handleWithdraw() {
        if (!isValid) return
        setSubmitting(true)
        setError(null)

        const result = await requestWithdrawal(amount)

        if (result.error) {
            setError(result.error)
            setSubmitting(false)
            return
        }

        setSuccess(true)
        setSubmitting(false)
        // Refresh wallet
        const { data } = await getWallet()
        setWallet(data ?? null)
        setWithdrawAmount('')
    }

    async function handleStripeConnect() {
        setSubmitting(true)
        setError(null)

        const result = await createStripeConnectLink()

        if (result.error) {
            setError(result.error)
            setSubmitting(false)
            return
        }

        if (result.url) {
            window.location.href = result.url
        }
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-md p-4">
                <p className="text-muted-foreground">Loading...</p>
            </div>
        )
    }

    const needsOnboarding = !wallet?.stripe_connect_id || !wallet?.stripe_connect_onboarded

    return (
        <div className="mx-auto max-w-md space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Withdraw</h1>
                <Link href="/app/wallet" className="text-sm text-muted-foreground hover:underline">
                    ← Back
                </Link>
            </div>

            {/* Balance */}
            <div className="rounded-xl border bg-card p-6">
                <p className="text-sm text-muted-foreground">Available to withdraw</p>
                <p className="text-3xl font-bold">
                    £{((wallet?.balance_pence ?? 0) / 100).toFixed(2)}
                </p>
            </div>

            {needsOnboarding ? (
                <div className="rounded-xl border bg-card p-6 space-y-4">
                    <h2 className="font-semibold">Connect your bank account</h2>
                    <p className="text-sm text-muted-foreground">
                        To withdraw funds, you need to complete Stripe verification.
                        This is a one-time setup that verifies your identity and bank details.
                    </p>
                    <button
                        onClick={handleStripeConnect}
                        disabled={submitting}
                        className="w-full rounded-lg bg-primary py-3 text-center font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                        {submitting ? 'Redirecting...' : 'Set Up Withdrawals'}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {success && (
                        <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
                            <p className="text-green-700 dark:text-green-400 font-medium">
                                Withdrawal initiated! Funds will arrive in your bank account within 2-3 business days.
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="text-sm font-medium">Withdrawal amount</label>
                        <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                            <input
                                type="number"
                                min="5"
                                max={(wallet?.balance_pence ?? 0) / 100}
                                step="0.01"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                placeholder="5.00"
                                className="w-full rounded-lg border bg-background py-3 pl-8 pr-4 text-lg"
                            />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Minimum £5</p>
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <button
                        onClick={handleWithdraw}
                        disabled={!isValid || submitting}
                        className="w-full rounded-lg bg-primary py-3 text-center font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Processing...' : 'Withdraw Funds'}
                    </button>
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/app/wallet/withdraw/page.tsx
git commit -m "feat: add withdrawal page with Stripe Connect onboarding"
```

---

### Task 15: Dashboard wallet widget and top-up modal

**Files:**
- Create: `src/components/app/TopUpModal.tsx`
- Create: `src/components/app/WalletWidget.tsx`

- [ ] **Step 1: Write the TopUpModal component**

```tsx
// src/components/app/TopUpModal.tsx
'use client'

import { useState } from 'react'
import { createTopUpSession } from '@/app/app/wallet/actions'
import { calculateChargeAmount } from '@/lib/stripe/config'

const PRESET_AMOUNTS = [10, 20, 50]

interface TopUpModalProps {
    open: boolean
    onClose: () => void
    prefillAmount?: number
}

export default function TopUpModal({ open, onClose, prefillAmount }: TopUpModalProps) {
    const [amount, setAmount] = useState<number | null>(prefillAmount ?? null)
    const [customAmount, setCustomAmount] = useState(prefillAmount ? '' : '')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!open) return null

    const effectiveAmount = amount ?? (customAmount ? parseFloat(customAmount) : null)
    const isValid = effectiveAmount !== null && effectiveAmount >= 5 && effectiveAmount <= 500

    const feeInfo = effectiveAmount && effectiveAmount >= 5
        ? calculateChargeAmount(Math.round(effectiveAmount * 100))
        : null

    async function handleSubmit() {
        if (!effectiveAmount || !isValid) return
        setLoading(true)
        setError(null)

        const result = await createTopUpSession(effectiveAmount)

        if (result.error) {
            setError(result.error)
            setLoading(false)
            return
        }

        if (result.url) {
            window.location.href = result.url
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="w-full max-w-sm rounded-xl bg-card border shadow-lg p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Add Funds</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">
                        &times;
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {PRESET_AMOUNTS.map((preset) => (
                        <button
                            key={preset}
                            onClick={() => { setAmount(preset); setCustomAmount('') }}
                            className={`rounded-lg border-2 py-3 text-center font-semibold text-sm transition ${
                                amount === preset
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:border-primary/50'
                            }`}
                        >
                            £{preset}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                    <input
                        type="number"
                        min="5"
                        max="500"
                        step="0.01"
                        value={customAmount}
                        onChange={(e) => { setCustomAmount(e.target.value); setAmount(null) }}
                        placeholder="Custom amount"
                        className="w-full rounded-lg border bg-background py-2.5 pl-7 pr-4 text-sm"
                    />
                </div>

                {feeInfo && isValid && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                        <div className="flex justify-between">
                            <span>Wallet credit: £{effectiveAmount!.toFixed(2)}</span>
                            <span>Fee: ~£{(feeInfo.estimatedFeePence / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-medium text-foreground">
                            <span>Total charge</span>
                            <span>£{(feeInfo.chargePence / 100).toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {error && <p className="text-xs text-red-500">{error}</p>}

                <button
                    onClick={handleSubmit}
                    disabled={!isValid || loading}
                    className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Redirecting...' : 'Pay with Stripe'}
                </button>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Write the WalletWidget component**

```tsx
// src/components/app/WalletWidget.tsx
'use client'

import { useState, useEffect } from 'react'
import { getWallet } from '@/app/app/wallet/actions'
import TopUpModal from './TopUpModal'
import Link from 'next/link'
import type { Wallet } from '@/lib/types'

interface WalletWidgetProps {
    userRole: string
}

export default function WalletWidget({ userRole }: WalletWidgetProps) {
    const [wallet, setWallet] = useState<Wallet | null>(null)
    const [loading, setLoading] = useState(true)
    const [showTopUp, setShowTopUp] = useState(false)

    useEffect(() => {
        async function load() {
            const { data } = await getWallet()
            setWallet(data ?? null)
            setLoading(false)
        }
        load()
    }, [])

    const isCoach = userRole === 'coach'

    return (
        <>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">Wallet</h3>
                    <Link href="/app/wallet" className="text-xs text-primary hover:underline">
                        View all →
                    </Link>
                </div>

                {loading ? (
                    <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-2xl font-bold">
                                    £{((wallet?.balance_pence ?? 0) / 100).toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">Available</p>
                            </div>
                            {isCoach && (wallet?.escrow_pence ?? 0) > 0 && (
                                <div className="text-right">
                                    <p className="text-lg font-semibold text-amber-600">
                                        £{((wallet?.escrow_pence ?? 0) / 100).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">In escrow</p>
                                </div>
                            )}
                        </div>

                        {isCoach ? (
                            <button
                                onClick={() => setShowTopUp(true)}
                                className="w-full rounded-lg bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition"
                            >
                                + Add Funds
                            </button>
                        ) : (
                            <Link
                                href="/app/wallet/withdraw"
                                className="block w-full rounded-lg bg-primary/10 py-2 text-center text-sm font-medium text-primary hover:bg-primary/20 transition"
                            >
                                Withdraw
                            </Link>
                        )}
                    </div>
                )}
            </div>

            <TopUpModal open={showTopUp} onClose={() => setShowTopUp(false)} />
        </>
    )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/app/TopUpModal.tsx src/components/app/WalletWidget.tsx
git commit -m "feat: add WalletWidget dashboard card and TopUpModal component"
```

---

### Task 16: Add WalletWidget to dashboard

**Files:**
- Modify: `src/app/app/page.tsx`

- [ ] **Step 1: Import WalletWidget**

At the top of `src/app/app/page.tsx`, add:

```typescript
import WalletWidget from '@/components/app/WalletWidget'
```

- [ ] **Step 2: Add widget to coach dashboard section**

In the coach dashboard section (around lines 52-121), find the stats cards grid. After the existing stats cards section and before the recent bookings section, add:

```tsx
<WalletWidget userRole="coach" />
```

- [ ] **Step 3: Add widget to referee dashboard section**

In the referee dashboard section (around lines 123-175), add:

```tsx
<WalletWidget userRole="referee" />
```

- [ ] **Step 4: Commit**

```bash
git add src/app/app/page.tsx
git commit -m "feat: add WalletWidget to coach and referee dashboards"
```

---

### Task 17: Add wallet balance to navigation

**Files:**
- Create: `src/components/app/WalletBalanceNav.tsx`
- Modify: `src/app/app/layout.tsx`

- [ ] **Step 1: Write WalletBalanceNav component**

```tsx
// src/components/app/WalletBalanceNav.tsx
'use client'

import { useState, useEffect } from 'react'
import { getWallet } from '@/app/app/wallet/actions'
import Link from 'next/link'

export default function WalletBalanceNav() {
    const [balance, setBalance] = useState<number | null>(null)

    useEffect(() => {
        async function load() {
            const { data } = await getWallet()
            setBalance(data?.balance_pence ?? null)
        }
        load()
    }, [])

    if (balance === null) return null

    return (
        <Link
            href="/app/wallet"
            className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/80 transition"
        >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h5.25A2.25 2.25 0 0121 6v6zm0 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6" />
            </svg>
            £{(balance / 100).toFixed(2)}
        </Link>
    )
}
```

- [ ] **Step 2: Add to app layout header**

In `src/app/app/layout.tsx`, import the component:

```typescript
import WalletBalanceNav from '@/components/app/WalletBalanceNav'
```

Add `<WalletBalanceNav />` inside the header area, alongside the existing `AppHeader` component.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/WalletBalanceNav.tsx src/app/app/layout.tsx
git commit -m "feat: add wallet balance indicator to app navigation header"
```

---

## Phase 6: Escrow Release & Disputes

### Task 18: Escrow release cron job

**Files:**
- Create: `src/app/api/cron/escrow-release/route.ts`

- [ ] **Step 1: Write the cron handler**

```typescript
// src/app/api/cron/escrow-release/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'

export async function GET(req: NextRequest) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const now = new Date()
    const results = { nudges: 0, releases: 0, errors: [] as string[] }

    // ====================================================================
    // 1. Send 18-hour nudge notifications
    // ====================================================================
    const eighteenHoursAgo = new Date(now.getTime() - 18 * 60 * 60 * 1000)

    const { data: nudgeBookings } = await supabase
        .from('bookings')
        .select('id, coach_id, match_date, kickoff_time, ground_name, location_postcode, escrow_amount_pence')
        .eq('status', 'confirmed')
        .not('escrow_amount_pence', 'is', null)
        .is('escrow_released_at', null)
        .is('nudge_sent_at', null)

    if (nudgeBookings) {
        for (const booking of nudgeBookings) {
            const kickoff = new Date(`${booking.match_date}T${booking.kickoff_time}`)
            if (kickoff <= eighteenHoursAgo && kickoff > new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
                // Check no open dispute
                const { data: dispute } = await supabase
                    .from('disputes')
                    .select('id')
                    .eq('booking_id', booking.id)
                    .eq('status', 'open')
                    .maybeSingle()

                if (!dispute) {
                    await createNotification({
                        userId: booking.coach_id,
                        title: 'Match Auto-Completing Soon',
                        message: `Your match at ${booking.ground_name || booking.location_postcode} will auto-complete in 6 hours. Raise a dispute if there was an issue.`,
                        type: 'info',
                        link: `/app/bookings/${booking.id}`,
                    })

                    await supabase
                        .from('bookings')
                        .update({ nudge_sent_at: now.toISOString() })
                        .eq('id', booking.id)

                    results.nudges++
                }
            }
        }
    }

    // ====================================================================
    // 2. Release escrow for bookings past 24 hours
    // ====================================================================
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const { data: releaseBookings } = await supabase
        .from('bookings')
        .select(`
            id, coach_id, match_date, kickoff_time, ground_name, location_postcode,
            escrow_amount_pence,
            booking_assignments!inner(referee_id)
        `)
        .eq('status', 'confirmed')
        .not('escrow_amount_pence', 'is', null)
        .is('escrow_released_at', null)

    if (releaseBookings) {
        for (const booking of releaseBookings) {
            const kickoff = new Date(`${booking.match_date}T${booking.kickoff_time}`)
            if (kickoff > twentyFourHoursAgo) continue // Not yet 24h

            // Check no open dispute
            const { data: dispute } = await supabase
                .from('disputes')
                .select('id')
                .eq('booking_id', booking.id)
                .eq('status', 'open')
                .maybeSingle()

            if (dispute) continue // Dispute blocks release

            // Execute escrow release via RPC
            const { data: result, error: rpcError } = await supabase.rpc('escrow_release', {
                p_booking_id: booking.id,
                p_platform_fee_pence: 0, // No platform fee at launch
            })

            if (rpcError || result?.error) {
                const errMsg = rpcError?.message || result?.error
                console.error(`Escrow release failed for booking ${booking.id}:`, errMsg)
                results.errors.push(`Booking ${booking.id}: ${errMsg}`)
                continue
            }

            const refereeId = (booking.booking_assignments as unknown as { referee_id: string }[])[0]?.referee_id

            // Notify both parties
            await Promise.allSettled([
                createNotification({
                    userId: booking.coach_id,
                    title: 'Payment Released',
                    message: `Payment of £${((booking.escrow_amount_pence ?? 0) / 100).toFixed(2)} has been released for your match at ${booking.ground_name || booking.location_postcode}.`,
                    type: 'success',
                    link: `/app/bookings/${booking.id}`,
                }),
                refereeId ? createNotification({
                    userId: refereeId,
                    title: 'Payment Received',
                    message: `£${((booking.escrow_amount_pence ?? 0) / 100).toFixed(2)} has been added to your wallet for the match at ${booking.ground_name || booking.location_postcode}.`,
                    type: 'success',
                    link: '/app/wallet',
                }) : Promise.resolve(),
            ])

            results.releases++
        }
    }

    console.log('Escrow release cron completed:', results)

    return NextResponse.json({
        success: true,
        ...results,
        timestamp: now.toISOString(),
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/escrow-release/route.ts
git commit -m "feat: add escrow release cron job with 18h nudge and 24h auto-release"
```

---

### Task 19: Add Vercel cron configuration

**Files:**
- Create or modify: `vercel.json`

- [ ] **Step 1: Add cron schedule**

Create `vercel.json` in the project root (or add to existing):

```json
{
    "crons": [
        {
            "path": "/api/cron/escrow-release",
            "schedule": "*/15 * * * *"
        }
    ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: add Vercel cron configuration for escrow release (every 15 min)"
```

---

### Task 20: Dispute creation and management

**Files:**
- Create: `src/app/app/disputes/actions.ts`
- Create: `src/app/app/disputes/page.tsx`

- [ ] **Step 1: Write dispute server actions**

```typescript
// src/app/app/disputes/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'
import { revalidatePath } from 'next/cache'
import { validate } from '@/lib/validation'
import { disputeSchema } from '@/lib/validation'
import type { Dispute } from '@/lib/types'

export async function raiseDispute(bookingId: string, reason: string): Promise<{
    success?: boolean
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const validationError = validate(disputeSchema, { bookingId, reason })
    if (validationError) {
        return { error: validationError }
    }

    // Verify user is involved in this booking
    const { data: booking } = await supabase
        .from('bookings')
        .select('id, coach_id, status, booking_assignments(referee_id)')
        .eq('id', bookingId)
        .eq('status', 'confirmed')
        .single()

    if (!booking) {
        return { error: 'Booking not found or not in confirmed status' }
    }

    const assignment = (booking.booking_assignments as unknown as { referee_id: string }[])[0]
    const isCoach = booking.coach_id === user.id
    const isReferee = assignment?.referee_id === user.id

    if (!isCoach && !isReferee) {
        return { error: 'You are not involved in this booking' }
    }

    // Check if dispute already exists
    const { data: existing } = await supabase
        .from('disputes')
        .select('id')
        .eq('booking_id', bookingId)
        .maybeSingle()

    if (existing) {
        return { error: 'A dispute has already been raised for this booking' }
    }

    const { error: insertError } = await supabase
        .from('disputes')
        .insert({
            booking_id: bookingId,
            raised_by: user.id,
            reason,
        })

    if (insertError) {
        return { error: insertError.message }
    }

    // Notify admins
    const adminSupabase = createAdminClient()
    const { data: admins } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')

    if (admins) {
        await Promise.allSettled(
            admins.map(admin =>
                createNotification({
                    userId: admin.id,
                    title: 'New Dispute Raised',
                    message: `A dispute has been raised for a booking. Reason: ${reason.substring(0, 100)}`,
                    type: 'warning',
                    link: '/app/disputes',
                })
            )
        )
    }

    revalidatePath('/app/disputes')
    revalidatePath(`/app/bookings/${bookingId}`)
    return { success: true }
}

export async function getDisputes(): Promise<{ data?: Dispute[]; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { data, error } = await supabase
        .from('disputes')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return { error: error.message }
    }

    return { data: data ?? [] }
}

export async function resolveDispute(
    disputeId: string,
    resolution: 'resolved_coach' | 'resolved_referee' | 'resolved_split',
    adminNotes: string,
    splitCoachPence?: number
): Promise<{ success?: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Verify admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return { error: 'Only admins can resolve disputes' }
    }

    if (!adminNotes || adminNotes.length < 5) {
        return { error: 'Please provide a reason for the resolution' }
    }

    // Get dispute with booking info
    const { data: dispute } = await supabase
        .from('disputes')
        .select('*, booking:bookings(id, coach_id, escrow_amount_pence, escrow_released_at)')
        .eq('id', disputeId)
        .eq('status', 'open')
        .single()

    if (!dispute) {
        return { error: 'Dispute not found or already resolved' }
    }

    const booking = dispute.booking as unknown as {
        id: string; coach_id: string; escrow_amount_pence: number; escrow_released_at: string | null
    }

    const adminSupabase = createAdminClient()

    // Handle resolution based on type
    if (resolution === 'resolved_coach') {
        // Full refund to coach
        const { error: rpcError } = await adminSupabase.rpc('escrow_refund', {
            p_booking_id: booking.id,
        })
        if (rpcError) {
            return { error: 'Failed to refund escrow: ' + rpcError.message }
        }
    } else if (resolution === 'resolved_referee') {
        // Release to referee
        const { error: rpcError } = await adminSupabase.rpc('escrow_release', {
            p_booking_id: booking.id,
            p_platform_fee_pence: 0,
        })
        if (rpcError) {
            return { error: 'Failed to release escrow: ' + rpcError.message }
        }
    } else if (resolution === 'resolved_split' && splitCoachPence !== undefined) {
        // Partial refund to coach, rest to referee
        const refundAmount = splitCoachPence
        const refereeAmount = (booking.escrow_amount_pence ?? 0) - refundAmount

        // Refund coach portion
        const { error: refundErr } = await adminSupabase.rpc('escrow_refund', {
            p_booking_id: booking.id,
            p_refund_pence: refundAmount,
        })
        if (refundErr) {
            return { error: 'Failed to process split refund: ' + refundErr.message }
        }

        // Release referee portion
        const { error: releaseErr } = await adminSupabase.rpc('escrow_release', {
            p_booking_id: booking.id,
            p_platform_fee_pence: 0,
        })
        if (releaseErr) {
            return { error: 'Failed to process split release: ' + releaseErr.message }
        }
    }

    // Update dispute status
    await adminSupabase
        .from('disputes')
        .update({
            status: resolution,
            admin_notes: adminNotes,
            admin_user_id: user.id,
            resolved_at: new Date().toISOString(),
        })
        .eq('id', disputeId)

    // Update booking status
    await adminSupabase
        .from('bookings')
        .update({ status: resolution === 'resolved_coach' ? 'cancelled' : 'completed' })
        .eq('id', booking.id)

    revalidatePath('/app/disputes')
    revalidatePath(`/app/bookings/${booking.id}`)
    return { success: true }
}
```

- [ ] **Step 2: Write admin disputes page**

```tsx
// src/app/app/disputes/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDisputes } from './actions'
import Link from 'next/link'
import DisputeResolver from './DisputeResolver'

export default async function DisputesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        redirect('/app')
    }

    const { data: disputes } = await getDisputes()

    const openDisputes = disputes?.filter(d => d.status === 'open') ?? []
    const resolvedDisputes = disputes?.filter(d => d.status !== 'open') ?? []

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Disputes</h1>
                <Link href="/app" className="text-sm text-muted-foreground hover:underline">
                    ← Dashboard
                </Link>
            </div>

            {openDisputes.length === 0 && resolvedDisputes.length === 0 && (
                <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                    No disputes raised yet.
                </div>
            )}

            {openDisputes.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-red-600">
                        Open Disputes ({openDisputes.length})
                    </h2>
                    {openDisputes.map(dispute => (
                        <DisputeResolver key={dispute.id} dispute={dispute} />
                    ))}
                </div>
            )}

            {resolvedDisputes.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-muted-foreground">
                        Resolved ({resolvedDisputes.length})
                    </h2>
                    {resolvedDisputes.map(dispute => (
                        <div key={dispute.id} className="rounded-xl border bg-card p-4 opacity-60">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Booking: {dispute.booking_id.substring(0, 8)}...</p>
                                <span className="text-xs rounded-full bg-muted px-2 py-1">
                                    {dispute.status.replace('resolved_', 'Resolved: ')}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{dispute.reason}</p>
                            {dispute.admin_notes && (
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                    Admin: {dispute.admin_notes}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 3: Write DisputeResolver client component**

Create `src/app/app/disputes/DisputeResolver.tsx`:

```tsx
// src/app/app/disputes/DisputeResolver.tsx
'use client'

import { useState } from 'react'
import { resolveDispute } from './actions'
import type { Dispute } from '@/lib/types'

export default function DisputeResolver({ dispute }: { dispute: Dispute }) {
    const [resolution, setResolution] = useState<string>('')
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleResolve() {
        if (!resolution || !notes) return
        setLoading(true)
        setError(null)

        const result = await resolveDispute(
            dispute.id,
            resolution as 'resolved_coach' | 'resolved_referee' | 'resolved_split',
            notes
        )

        if (result.error) {
            setError(result.error)
            setLoading(false)
            return
        }

        // Page will revalidate
    }

    return (
        <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Booking: {dispute.booking_id.substring(0, 8)}...</p>
                <span className="text-xs rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-1">
                    Open
                </span>
            </div>

            <p className="text-sm">{dispute.reason}</p>
            <p className="text-xs text-muted-foreground">
                Raised: {new Date(dispute.created_at).toLocaleDateString('en-GB')}
            </p>

            <div className="border-t pt-3 space-y-2">
                <label className="text-sm font-medium">Resolution</label>
                <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full rounded-lg border bg-background p-2 text-sm"
                >
                    <option value="">Select resolution...</option>
                    <option value="resolved_coach">Refund to Coach</option>
                    <option value="resolved_referee">Release to Referee</option>
                    <option value="resolved_split">Split</option>
                </select>

                <label className="text-sm font-medium">Admin Notes (required)</label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Explain the resolution..."
                    className="w-full rounded-lg border bg-background p-2 text-sm min-h-[80px]"
                />

                {error && <p className="text-xs text-red-500">{error}</p>}

                <button
                    onClick={handleResolve}
                    disabled={!resolution || !notes || loading}
                    className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                    {loading ? 'Processing...' : 'Resolve Dispute'}
                </button>
            </div>
        </div>
    )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/app/disputes/actions.ts src/app/app/disputes/page.tsx src/app/app/disputes/DisputeResolver.tsx
git commit -m "feat: add dispute creation, admin management page, and resolution flow"
```

---

### Task 21: Add dispute button to BookingActions

**Files:**
- Modify: `src/app/app/bookings/[id]/BookingActions.tsx`

- [ ] **Step 1: Add dispute action to confirmed bookings**

In the confirmed booking section (Scenario 3, around lines 324-432), after the existing cancel button but before the closing tags, add a dispute button:

```tsx
{booking.status === 'confirmed' && booking.escrow_amount_pence && !booking.escrow_released_at && (
    <button
        onClick={async () => {
            const reason = prompt('Please describe the issue (minimum 10 characters):')
            if (reason && reason.length >= 10) {
                const { raiseDispute } = await import('@/app/app/disputes/actions')
                const result = await raiseDispute(booking.id, reason)
                if (result.error) {
                    toast.error(result.error)
                } else {
                    toast.success('Dispute raised. An admin will review it.')
                }
            }
        }}
        className="w-full rounded-lg border border-red-300 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
    >
        Raise Dispute
    </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/app/bookings/[id]/BookingActions.tsx
git commit -m "feat: add dispute button to confirmed booking actions"
```

---

## Phase 7: Reconciliation & Monitoring

### Task 22: Weekly reconciliation cron job

**Files:**
- Create: `src/app/api/cron/reconcile/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Write the reconciliation handler**

```typescript
// src/app/api/cron/reconcile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const now = new Date()
    const mismatches: string[] = []

    // 1. Reconcile wallet balances against transaction sums
    const { data: wallets } = await supabase
        .from('wallets')
        .select('id, user_id, balance_pence, escrow_pence')

    if (wallets) {
        for (const wallet of wallets) {
            const { data: transactions } = await supabase
                .from('wallet_transactions')
                .select('amount_pence, direction')
                .eq('wallet_id', wallet.id)

            if (!transactions) continue

            let expectedBalance = 0
            for (const tx of transactions) {
                if (tx.direction === 'credit') {
                    expectedBalance += tx.amount_pence
                } else {
                    expectedBalance -= tx.amount_pence
                }
            }

            // balance_pence + escrow_pence should equal net of all transactions
            const actualTotal = wallet.balance_pence + wallet.escrow_pence
            if (actualTotal !== expectedBalance) {
                mismatches.push(
                    `Wallet ${wallet.id} (user ${wallet.user_id}): ` +
                    `expected ${expectedBalance}, actual ${actualTotal} ` +
                    `(balance: ${wallet.balance_pence}, escrow: ${wallet.escrow_pence})`
                )
            }
        }
    }

    // 2. Check for stuck escrow (>7 days past match date)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const sevenDaysAgoDate = sevenDaysAgo.toISOString().split('T')[0]

    const { data: stuckBookings } = await supabase
        .from('bookings')
        .select('id, coach_id, match_date, escrow_amount_pence')
        .eq('status', 'confirmed')
        .not('escrow_amount_pence', 'is', null)
        .is('escrow_released_at', null)
        .lt('match_date', sevenDaysAgoDate)

    // 3. Alert admins if issues found
    if (mismatches.length > 0 || (stuckBookings && stuckBookings.length > 0)) {
        const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin')

        if (admins) {
            const alerts: string[] = []

            if (mismatches.length > 0) {
                alerts.push(`${mismatches.length} wallet balance mismatch(es) detected`)
            }

            if (stuckBookings && stuckBookings.length > 0) {
                alerts.push(`${stuckBookings.length} booking(s) with escrow stuck >7 days past match date`)
            }

            for (const admin of admins) {
                await createNotification({
                    userId: admin.id,
                    title: 'Wallet Reconciliation Alert',
                    message: alerts.join('. ') + '. Please review in admin dashboard.',
                    type: 'warning',
                    link: '/app/disputes',
                })
            }
        }
    }

    console.log('Reconciliation completed:', {
        walletsChecked: wallets?.length ?? 0,
        mismatches: mismatches.length,
        stuckEscrow: stuckBookings?.length ?? 0,
        timestamp: now.toISOString(),
    })

    return NextResponse.json({
        success: true,
        walletsChecked: wallets?.length ?? 0,
        mismatches,
        stuckEscrow: stuckBookings?.map(b => b.id) ?? [],
        timestamp: now.toISOString(),
    })
}
```

- [ ] **Step 2: Add reconciliation cron to vercel.json**

Update `vercel.json`:

```json
{
    "crons": [
        {
            "path": "/api/cron/escrow-release",
            "schedule": "*/15 * * * *"
        },
        {
            "path": "/api/cron/reconcile",
            "schedule": "0 6 * * 1"
        }
    ]
}
```

The reconciliation runs every Monday at 6am UTC.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/reconcile/route.ts vercel.json
git commit -m "feat: add weekly wallet reconciliation cron with escrow timeout alerts"
```

---

## Phase 8: Environment & Final Configuration

### Task 23: Environment variables documentation


**Files:**
- No file changes — document what needs to be added to `.env.local`

- [ ] **Step 1: Add required environment variables**

Add these to `.env.local`:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cron job security
CRON_SECRET=your-random-secret-string
```

- [ ] **Step 2: Update CLAUDE.md environment section**

In `CLAUDE.md`, add the new environment variables to the "Environment Variables" section:

```markdown
# Stripe
STRIPE_SECRET_KEY=your_stripe_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Cron security
CRON_SECRET=your_cron_secret
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Stripe and cron environment variables to CLAUDE.md"
```

---

### Task 24: Build verification

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Fix any build errors**

If there are type errors or import issues, fix them and re-run the build.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors from wallet system integration"
```

---

## Summary

### Phase order and dependencies

```
Phase 1 (DB Foundation)       → Tasks 1-4: Schema, RLS, RPCs (incl. wallet_withdraw + admin_wallet_adjustment)
Phase 2 (Stripe + Types)      → Tasks 5-6: SDK install, types, validation
Phase 3 (Wallet Actions)      → Tasks 7-8: Server actions, webhook
Phase 4 (Booking Flow)        → Tasks 9-11: confirmPrice update, cancel refund, BookingActions UI
Phase 5 (Wallet UI)           → Tasks 12-17: Pages, widget, modal, nav balance
Phase 6 (Escrow + Disputes)   → Tasks 18-21: Cron job, Vercel config, dispute system
Phase 7 (Reconciliation)      → Task 22: Weekly reconciliation + escrow timeout alerts
Phase 8 (Config + Verify)     → Tasks 23-24: Env vars, build check
```

### New environment variables needed

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe API server key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `CRON_SECRET` | Protects cron endpoint from unauthorized access |
