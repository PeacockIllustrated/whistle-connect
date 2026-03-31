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
