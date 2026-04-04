-- ============================================================================
-- Migration 0132: Backfill platform field on push_subscriptions
--
-- The PushNotificationManager was saving subscriptions without the
-- platform field, causing notifications.ts to filter them out when
-- splitting by platform ('web' vs 'firebase'). This backfill sets
-- platform='web' on all rows where it's NULL and p256dh is present
-- (web push subs have VAPID keys, Firebase tokens don't).
-- ============================================================================

UPDATE push_subscriptions
SET platform = 'web'
WHERE platform IS NULL
  AND p256dh IS NOT NULL;

UPDATE push_subscriptions
SET platform = 'firebase'
WHERE platform IS NULL
  AND p256dh IS NULL;
