-- Add platform column to push_subscriptions to distinguish web-push from Firebase tokens.
-- Default 'web' preserves all existing rows as web-push subscriptions (backward compatible).

ALTER TABLE push_subscriptions
    ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'firebase'));

-- Firebase tokens don't use VAPID keys — relax NOT NULL on p256dh and auth.
ALTER TABLE push_subscriptions ALTER COLUMN p256dh DROP NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN auth DROP NOT NULL;

-- Index for efficient platform-based filtering during notification sends.
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_platform
    ON push_subscriptions(platform);
