-- ============================================================================
-- Migration 0147: clear web push subscriptions after VAPID key rotation
-- Date: 2026-04-30
--
-- Web Push subscriptions are tied to the public VAPID key the browser was
-- given at subscribe-time. Once we rotate VAPID keys (happening in this
-- launch hardening pass), every existing `push_subscriptions` row with
-- platform='web' is dead — sends to those endpoints will return 410 Gone
-- (or worse, silently fail authentication).
--
-- Wiping them now is cleaner than waiting for reactive 410-cleanup. The
-- next time each user opens the PWA, the service worker will re-register
-- under the NEW public key and write a fresh row, so the user experience
-- is "you'll see the OS permission prompt one more time on next visit".
--
-- Firebase rows are unaffected — those use a different key path.
-- ============================================================================

DELETE FROM public.push_subscriptions
WHERE platform = 'web';
