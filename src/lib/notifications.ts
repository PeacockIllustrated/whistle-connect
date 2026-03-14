'use server'

import { createClient } from '@/lib/supabase/server'
import { isFirebaseConfigured, sendFCMMessage } from '@/lib/firebase-admin'
import type { FCMMessage } from '@/lib/firebase-admin'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export type NotificationCategory =
    | 'booking_update'
    | 'offer_update'
    | 'match_reminder'
    | 'new_match_nearby'
    | 'sos_alert'
    | 'message'
    | 'verification'
    | 'rating'
    | 'system'

interface CreateNotificationParams {
    userId: string
    title: string
    message: string
    type: NotificationType
    link?: string
    category?: NotificationCategory
    /** Set to 'sos' for high-priority delivery on native devices */
    urgency?: 'normal' | 'sos'
}

export async function createNotification({
    userId, title, message, type, link, category = 'system', urgency = 'normal',
}: CreateNotificationParams): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    // 1. Create in-app notification via SECURITY DEFINER RPC function
    //    The RPC respects user's in-app preference for this category
    const { error } = await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_title: title,
        p_message: message,
        p_type: type,
        p_link: link || null,
        p_category: category,
    })

    if (error) {
        console.error('Failed to create notification:', error)
        return { success: false, error: error.message }
    }

    // 2. Check user's push preference for this category (default: enabled)
    const { data: pushPref } = await supabase
        .from('notification_preferences')
        .select('push')
        .eq('user_id', userId)
        .eq('category', category)
        .maybeSingle()

    const pushEnabled = pushPref?.push ?? true
    if (!pushEnabled) {
        return { success: true }
    }

    // 3. Fetch ALL push subscriptions for this user
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
    const payload = { title, body: message, link: link || '/app' }

    // 4a. Send via web-push (existing flow)
    if (webSubs.length > 0) {
        await sendWebPush(supabase, webSubs, payload)
    }

    // 4b. Send via Firebase Cloud Messaging (native apps)
    if (firebaseSubs.length > 0) {
        await sendFirebasePush(supabase, firebaseSubs, payload, isSOS)
    }

    return { success: true }
}

/**
 * Send notifications to multiple users in parallel.
 * Failures are logged but don't prevent other notifications from being sent.
 */
export async function createNotifications(
    notifications: CreateNotificationParams[]
): Promise<{ success: boolean; failedCount: number }> {
    const results = await Promise.allSettled(
        notifications.map(params => createNotification(params))
    )
    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length > 0) {
        console.error(`Failed to send ${failed.length}/${notifications.length} notifications`)
    }
    return { success: true, failedCount: failed.length }
}

// ---------------------------------------------------------------------------
// Web Push sender (extracted from the original implementation, unchanged logic)
// ---------------------------------------------------------------------------

async function sendWebPush(
    supabase: Awaited<ReturnType<typeof createClient>>,
    subscriptions: Array<{ id: string; endpoint: string; p256dh: string | null; auth: string | null }>,
    payload: { title: string; body: string; link: string },
) {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        return
    }

    try {
        const webPush = (await import('web-push')).default

        webPush.setVapidDetails(
            'mailto:support@whistle-connect.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
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

        // Cleanup expired subscriptions (410 Gone)
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
