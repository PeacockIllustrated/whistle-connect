'use server'

import { createClient } from '@/lib/supabase/server'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

interface CreateNotificationParams {
    userId: string
    title: string
    message: string
    type: NotificationType
    link?: string
}

export async function createNotification({ userId, title, message, type, link }: CreateNotificationParams): Promise<{ success: boolean; error?: string }> {
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

    // 2. Send Push Notification
    if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        try {
            const webPush = (await import('web-push')).default

            webPush.setVapidDetails(
                'mailto:support@whistle-connect.com',
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY
            )

            const { data: subscriptions } = await supabase
                .from('push_subscriptions')
                .select('*')
                .eq('user_id', userId)

            if (subscriptions && subscriptions.length > 0) {
                const results = await Promise.allSettled(
                    subscriptions.map(async (sub) => {
                        const pushSubscription = {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth
                            }
                        }

                        const payload = JSON.stringify({
                            title,
                            body: message,
                            link: link || '/app'
                        })

                        await webPush.sendNotification(pushSubscription, payload)
                    })
                )

                // Cleanup invalid subscriptions (properly awaited)
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
            }
        } catch (error) {
            console.error('Failed to send push notifications:', error)
        }
    }

    return { success: true }
}
