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

export async function createNotification({ userId, title, message, type, link }: CreateNotificationParams) {
    const supabase = await createClient()

    // 1. Create in-app notification
    const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        title,
        message,
        type,
        link
    })

    if (error) {
        console.error('Failed to create notification:', error)
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

                // Cleanup invalid subscriptions
                results.forEach(async (result, index) => {
                    if (result.status === 'rejected' && result.reason.statusCode === 410) {
                        const sub = subscriptions[index]
                        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
                    }
                })
            }
        } catch (error) {
            console.error('Failed to send push notifications:', error)
        }
    }
}
