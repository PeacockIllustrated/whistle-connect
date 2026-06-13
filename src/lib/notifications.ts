'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'
import { isFirebaseConfigured, sendFCMMessage } from '@/lib/firebase-admin'
import { isEnabled } from '@/lib/feature-flags'
import { validateVapidKeys } from '@/lib/push/validate'
import type { FCMMessage } from '@/lib/firebase-admin'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

interface CreateNotificationParams {
    userId: string
    title: string
    message: string
    type: NotificationType
    link?: string
    /** Set to 'sos' for high-priority delivery on native devices */
    urgency?: 'normal' | 'sos'
    /**
     * 'transactional' (default) always sends — booking/payment/dispute events
     * the user has a direct stake in. 'engagement' is re-engagement / marketing
     * (the scheduled nudge cron): it is suppressed for users who have opted out
     * (`profiles.reengagement_opt_out`) or are suspended. This is a backstop —
     * the nudge cron also filters these out at candidate selection — so any
     * future engagement caller gets the opt-out honoured for free.
     */
    category?: 'transactional' | 'engagement'
}

export async function createNotification({
    userId, title, message, type, link, urgency = 'normal', category = 'transactional',
}: CreateNotificationParams): Promise<{ success: boolean; error?: string }> {
    // The `create_notification` RPC is granted to `service_role` ONLY
    // (migration 0163 — it has no internal auth.uid() check, so leaving it
    // callable by `authenticated` let any signed-in user spoof notifications to
    // any user_id). Reading the RECIPIENT's push_subscriptions also needs to
    // bypass RLS (you are notifying someone else). Both require the
    // service-role client, so a missing key means we cannot notify — surface it
    // loudly rather than silently writing nothing (WS-D's /api/admin/health
    // flags a missing key).
    const supabase = createAdminClient()
    if (!supabase) {
        console.error('createNotification: SUPABASE_SERVICE_ROLE_KEY missing — notification not sent')
        Sentry.captureMessage('createNotification: admin client unavailable (SUPABASE_SERVICE_ROLE_KEY missing)', {
            level: 'error',
            tags: { 'notification.failure': 'admin-client-missing' },
        })
        return { success: false, error: 'Notification service unavailable' }
    }

    // 0. Engagement / marketing suppression. Re-engagement nudges must honour
    //    the recipient's opt-out and never reach suspended accounts. We treat a
    //    suppressed nudge as a (no-op) success so callers don't log it as a
    //    failure. Transactional notifications skip this check entirely.
    if (category === 'engagement') {
        const { data: recipient } = await supabase
            .from('profiles')
            .select('reengagement_opt_out, suspended_at')
            .eq('id', userId)
            .maybeSingle()
        if (!recipient || recipient.reengagement_opt_out || recipient.suspended_at) {
            return { success: true }
        }
    }

    // 1. Create in-app notification via SECURITY DEFINER RPC function
    const { error } = await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_title: title,
        p_message: message,
        p_type: type,
        p_link: link || null
    })

    if (error) {
        console.error('Failed to create notification:', error)
        return { success: false, error: error.message }
    }

    // 2. Fetch ALL push subscriptions for this user
    const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)

    if (!subscriptions || subscriptions.length === 0) {
        return { success: true }
    }

    // Split subscriptions by platform
    const webSubs = subscriptions.filter(s => s.platform === 'web')
    const firebaseSubs = subscriptions.filter(s => s.platform === 'firebase')

    const isSOS = urgency === 'sos'
    const payload = {
        title,
        body: message,
        link: link || '/app',
        type,
        urgency,
    }

    // 3a. Send via web-push (existing flow). Kill-switchable: in-app row
    //     was already written above, so users still see notifications when
    //     they next load the app even if the push leg is gated. Errors
    //     (e.g. invalid VAPID keys) are logged but don't block the FCM
    //     leg below — both transports are independent.
    if (webSubs.length > 0) {
        if (!isEnabled('WEB_PUSH_ENABLED')) {
            console.log('[Notifications] Skipping web push — WEB_PUSH_ENABLED=false')
        } else {
            try {
                await sendWebPush(supabase, webSubs, payload)
            } catch (err) {
                console.error('[Notifications] sendWebPush threw:', err)
            }
        }
    }

    // 3b. Send via Firebase Cloud Messaging (native apps). Not gated by the
    //     web-push flag — native is a separate transport with its own
    //     reliability characteristics.
    if (firebaseSubs.length > 0) {
        try {
            await sendFirebasePush(supabase, firebaseSubs, payload, isSOS)
        } catch (err) {
            console.error('[Notifications] sendFirebasePush threw:', err)
        }
    }

    return { success: true }
}

// ---------------------------------------------------------------------------
// Web Push sender (extracted from the original implementation, unchanged logic)
// ---------------------------------------------------------------------------

async function sendWebPush(
    supabase: Awaited<ReturnType<typeof createClient>>,
    subscriptions: Array<{ id: string; endpoint: string; p256dh: string | null; auth: string | null }>,
    payload: { title: string; body: string; link: string },
) {
    // Validate keys once per server instance. Failures bubble up clearly
    // instead of the previous silent skip — Sentry / Vercel logs will see
    // the error and we'll know push is misconfigured before users do.
    const validation = validateVapidKeys()
    if (!validation.ok) {
        console.error(`[WebPush] ${validation.reason}`)
        Sentry.captureMessage(`[WebPush] VAPID validation failed: ${validation.reason}`, {
            level: 'error',
            tags: { 'push.transport': 'web', 'push.failure': 'vapid-' + validation.code.toLowerCase() },
        })
        // Throw so callers / observability tools see the failure. createNotification
        // wraps push send in a way that doesn't bubble to the user — in-app
        // notification has already been written, so the user is not blocked.
        throw new Error(`[WebPush] ${validation.reason}`)
    }

    try {
        const webPush = (await import('web-push')).default

        webPush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:tom@onesignanddigital.co.uk',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!
        )

        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh!,
                        auth: sub.auth!,
                    },
                }
                await webPush.sendNotification(
                    pushSubscription,
                    JSON.stringify(payload),
                )
            })
        )

        // Log any failures and cleanup expired subscriptions (410 Gone)
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const statusCode = (result.reason as { statusCode?: number })?.statusCode
                console.error(`[WebPush] Failed to send to subscription ${subscriptions[index].id}:`, statusCode, result.reason)
                // 410 = subscription expired, gets cleaned up below — not an
                // anomaly, no Sentry event. Anything else is unexpected.
                if (statusCode !== 410) {
                    Sentry.captureException(result.reason, {
                        tags: {
                            'push.transport': 'web',
                            'push.status_code': String(statusCode ?? 'unknown'),
                        },
                        extra: { subscription_id: subscriptions[index].id },
                    })
                }
            }
        })

        const delivered = results.filter(r => r.status === 'fulfilled').length
        console.log(`[WebPush] delivered ${delivered}/${results.length}`)
        // The premortem's silent-death signal: web subscriptions exist but NONE
        // were delivered (validation passed yet every send failed). Surface it
        // so "phones never buzz" can't hide behind in-app rows that write fine.
        if (delivered === 0 && results.length > 0) {
            Sentry.captureMessage(`[WebPush] 0 of ${results.length} web deliveries succeeded`, {
                level: 'error',
                tags: { 'push.transport': 'web', 'push.delivered': 'false' },
            })
        }

        const cleanupPromises = results
            .map((result, index) => {
                if (result.status === 'rejected' &&
                    (result.reason as { statusCode?: number })?.statusCode === 410) {
                    return supabase.from('push_subscriptions').delete().eq('id', subscriptions[index].id)
                }
                return null
            })
            .filter(Boolean)

        if (cleanupPromises.length > 0) {
            await Promise.allSettled(cleanupPromises)
        }
    } catch (error) {
        console.error('Failed to send web push notifications:', error)
    }
}

// ---------------------------------------------------------------------------
// Firebase Push sender (for native Android/iOS apps via Capacitor)
// ---------------------------------------------------------------------------

async function sendFirebasePush(
    supabase: Awaited<ReturnType<typeof createClient>>,
    subscriptions: Array<{ id: string; endpoint: string }>,
    payload: { title: string; body: string; link: string },
    isSOS: boolean,
) {
    if (!isFirebaseConfigured()) {
        console.warn('[FCM] Firebase not configured, skipping native push')
        // We reach here only when native tokens exist (createNotification only
        // calls this with firebaseSubs.length > 0), so native push is silently
        // dead. Surface it — Sentry dedups by message fingerprint.
        Sentry.captureMessage('[FCM] native push tokens exist but Firebase is not configured', {
            level: 'warning',
            tags: { 'push.transport': 'firebase', 'push.failure': 'fcm-not-configured', 'push.delivered': 'false' },
        })
        return
    }

    const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
            const message: FCMMessage = {
                token: sub.endpoint, // FCM token stored in endpoint column
                notification: {
                    title: payload.title,
                    body: payload.body,
                },
                data: {
                    link: payload.link,
                    type: isSOS ? 'sos' : 'normal',
                },
                android: {
                    priority: isSOS ? 'high' : 'normal',
                    notification: {
                        channelId: isSOS ? 'sos_channel' : 'default_channel',
                        ...(isSOS && {
                            priority: 'max' as const,
                            defaultVibrateTimings: false,
                            vibrateTimingsMillis: ['200', '100', '200', '100', '200'],
                        }),
                    },
                },
                apns: {
                    headers: {
                        'apns-priority': isSOS ? '10' : '5',
                    },
                    payload: {
                        aps: {
                            alert: {
                                title: payload.title,
                                body: payload.body,
                            },
                            sound: 'default',
                            ...(isSOS && { 'interruption-level': 'time-sensitive' as const }),
                        },
                    },
                },
            }

            await sendFCMMessage(message)
        })
    )

    // Surface FCM send failures to Sentry (web-push already does; FCM did not,
    // so native failures were invisible). NOT_FOUND/UNREGISTERED are expected
    // token churn (cleaned up below) — anything else is unexpected.
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            const errorCode = (result.reason as { code?: string })?.code
            if (errorCode !== 'NOT_FOUND' && errorCode !== 'UNREGISTERED') {
                Sentry.captureException(result.reason, {
                    tags: { 'push.transport': 'firebase', 'push.failure': errorCode || 'unknown' },
                    extra: { subscription_id: subscriptions[index].id },
                })
            }
        }
    })

    const delivered = results.filter(r => r.status === 'fulfilled').length
    console.log(`[FCM] delivered ${delivered}/${results.length}`)
    // Same silent-death signal as web: native tokens exist but none delivered.
    if (delivered === 0 && results.length > 0) {
        Sentry.captureMessage(`[FCM] 0 of ${results.length} native deliveries succeeded`, {
            level: 'error',
            tags: { 'push.transport': 'firebase', 'push.delivered': 'false' },
        })
    }

    // Cleanup invalid/unregistered tokens
    const cleanupPromises = results
        .map((result, index) => {
            if (result.status === 'rejected') {
                const errorCode = (result.reason as { code?: string })?.code
                if (errorCode === 'NOT_FOUND' || errorCode === 'UNREGISTERED') {
                    return supabase.from('push_subscriptions').delete().eq('id', subscriptions[index].id)
                }
            }
            return null
        })
        .filter(Boolean)

    if (cleanupPromises.length > 0) {
        await Promise.allSettled(cleanupPromises)
    }
}
