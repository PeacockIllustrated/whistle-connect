'use server'

import { createClient } from '@/lib/supabase/server'
import { isFirebaseConfigured, sendFCMMessage } from '@/lib/firebase-admin'
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
    const supabase = await createClient()

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

    // 3a. Send via web-push (existing flow)
    if (webSubs.length > 0) {
        await sendWebPush(supabase, webSubs, payload)
    }

    // 3b. Send via Firebase Cloud Messaging (native apps)
    if (firebaseSubs.length > 0) {
        await sendFirebasePush(supabase, firebaseSubs, payload, isSOS)
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
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.warn('[WebPush] VAPID keys not configured — skipping web push send')
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

        // Log any failures and cleanup expired subscriptions (410 Gone)
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const statusCode = (result.reason as { statusCode?: number })?.statusCode
                console.error(`[WebPush] Failed to send to subscription ${subscriptions[index].id}:`, statusCode, result.reason)
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
