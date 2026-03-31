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
    IF p_amount_pence <= 0 THEN
        RETURN json_build_object('error', 'Amount must be positive');
    END IF;

    IF EXISTS (
        SELECT 1 FROM wallet_transactions
        WHERE stripe_session_id = p_stripe_session_id
    ) THEN
        RETURN json_build_object('error', 'This payment has already been processed');
    END IF;

    SELECT * INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance_pence, escrow_pence)
        VALUES (p_user_id, 0, 0)
        RETURNING * INTO v_wallet;
    END IF;

    v_new_balance := v_wallet.balance_pence + p_amount_pence;

    UPDATE wallets
    SET balance_pence = v_new_balance
    WHERE id = v_wallet.id;

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

-- ============================================================================
-- escrow_hold: Reserve funds from coach wallet for a booking
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

    SELECT * INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Wallet not found. Please top up your wallet first.');
    END IF;

    IF v_wallet.balance_pence < p_amount_pence THEN
        RETURN json_build_object(
            'error', 'Insufficient funds',
            'balance_pence', v_wallet.balance_pence,
            'required_pence', p_amount_pence,
            'shortfall_pence', p_amount_pence - v_wallet.balance_pence
        );
    END IF;

    v_new_balance := v_wallet.balance_pence - p_amount_pence;
    v_new_escrow := v_wallet.escrow_pence + p_amount_pence;

    UPDATE wallets
    SET balance_pence = v_new_balance,
        escrow_pence = v_new_escrow
    WHERE id = v_wallet.id;

    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_wallet.id, 'escrow_hold', p_amount_pence, 'debit', v_new_balance,
        'booking', p_booking_id::TEXT,
        'Funds held in escrow for booking'
    );

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

-- ============================================================================
-- escrow_release: Release escrow funds to referee wallet
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

    v_referee_amount := v_booking.escrow_amount_pence - p_platform_fee_pence;
    IF v_referee_amount <= 0 THEN
        RETURN json_build_object('error', 'Platform fee exceeds escrow amount');
    END IF;

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

    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_coach_wallet.id, 'escrow_release', v_booking.escrow_amount_pence, 'debit',
        v_coach_wallet.balance_pence,
        'booking', p_booking_id::TEXT,
        'Escrow released to referee'
    );

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

    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_referee_wallet.id, 'escrow_release', v_referee_amount, 'credit',
        v_new_referee_balance,
        'booking', p_booking_id::TEXT,
        'Payment received for match'
    );

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

-- ============================================================================
-- escrow_refund: Return escrowed funds to coach wallet (cancellation/dispute)
-- ============================================================================
CREATE OR REPLACE FUNCTION escrow_refund(
    p_booking_id UUID,
    p_refund_pence INTEGER DEFAULT NULL
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

    v_refund_amount := COALESCE(p_refund_pence, v_booking.escrow_amount_pence);

    IF v_refund_amount > v_booking.escrow_amount_pence THEN
        RETURN json_build_object('error', 'Refund exceeds escrow amount');
    END IF;

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

    INSERT INTO wallet_transactions (
        wallet_id, type, amount_pence, direction, balance_after_pence,
        reference_type, reference_id, description
    ) VALUES (
        v_wallet.id, 'escrow_refund', v_refund_amount, 'credit', v_new_balance,
        'booking', p_booking_id::TEXT,
        'Escrow refunded — booking cancelled'
    );

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
    p_direction TEXT,
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
