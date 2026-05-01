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
}

export async function createNotification({
    userId, title, message, type, link, urgency = 'normal',
}: CreateNotificationParams): Promise<{ success: boolean; error?: string }> {
    // Prefer the service-role client where available. The
    // `create_notification` RPC is SECURITY DEFINER + scoped to whatever
    // userId the caller passes, but its EXECUTE grant is restricted to
    // `authenticated` and `service_role` (NOT `anon`). Cron jobs and other
    // session-less server contexts have no user cookie, so a regular
    // `createClient()` call runs as `anon` and is denied (Postgres 42501).
    // Falling back to the cookie-based client keeps RLS in play for the
    // push_subscriptions read when called from a real user session.
    const supabase = createAdminClient() ?? await createClient()

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
        console.log(`[Notifications] No push subscriptions found for user ${userId}`)
        return { success: true }
    }

    // Split subscriptions by platform
    const webSubs = subscriptions.filter(s => s.platform === 'web')
    const firebaseSubs = subscriptions.filter(s => s.platform === 'firebase')
    console.log(`[Notifications] Sending push to ${webSubs.length} web + ${firebaseSubs.length} firebase subscriptions`)

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
