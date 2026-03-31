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
