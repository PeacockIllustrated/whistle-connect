-- ============================================
-- FA Verification Response Token
-- Adds a unique token to each verification request
-- so County FAs can respond via a one-click link
-- ============================================

ALTER TABLE fa_verification_requests
    ADD COLUMN IF NOT EXISTS response_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- Backfill existing requests with tokens
UPDATE fa_verification_requests
SET response_token = gen_random_uuid()
WHERE response_token IS NULL;

-- Make it NOT NULL going forward
ALTER TABLE fa_verification_requests
    ALTER COLUMN response_token SET NOT NULL;

CREATE INDEX idx_fa_verification_token ON fa_verification_requests(response_token);
