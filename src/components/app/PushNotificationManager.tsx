'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export function PushNotificationManager() {
    const [isSupported, setIsSupported] = useState(false)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const [permission, setPermission] = useState<NotificationPermission>('default')

    // In a real app, you should fetch this key from the server or env
    // For now, we assume it's exposed via env
    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    async function registerServiceWorker() {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none',
        })
        const sub = await registration.pushManager.getSubscription()
        setSubscription(sub)
        setPermission(Notification.permission)
    }

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window && VAPID_PUBLIC_KEY) {
            setIsSupported(true)
            registerServiceWorker()
        }
    }, [VAPID_PUBLIC_KEY])


    async function subscribe() {
        if (!VAPID_PUBLIC_KEY) return

        try {
            const registration = await navigator.serviceWorker.ready
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            })
            setSubscription(sub)
            setPermission(Notification.permission)
            await saveSubscription(sub)
        } catch (error) {
            console.error('Failed to subscribe:', error)
        }
    }

    async function saveSubscription(sub: PushSubscription) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return

        const p256dh = sub.toJSON().keys?.p256dh
        const auth = sub.toJSON().keys?.auth

        if (!p256dh || !auth) return

        await supabase.from('push_subscriptions').upsert({
            user_id: user.id,
            endpoint: sub.endpoint,
            p256dh,
            auth
        }, { onConflict: 'user_id, endpoint' })
    }

    if (!isSupported) return null

    // Require explicit user interaction, maybe show a small prompt
    if (permission === 'denied') {
        return null // Can't do anything
    }

    if (!subscription) {
        return (
            <div className="fixed bottom-4 right-4 z-50 p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-lg max-w-sm animate-in fade-in slide-in-from-bottom-5">
                <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-white">Enable Notifications?</p>
                    <p className="text-xs text-white/70">Get instant updates about bookings and messages.</p>
                    <div className="flex gap-2 mt-1">
                        <button
                            onClick={subscribe}
                            className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-dark)] text-white text-xs px-3 py-1.5 rounded-md transition-colors"
                        >
                            Enable
                        </button>
                        <button
                            onClick={() => {
                                // Logic to dismiss (maybe save to local storage to not show again for a while)
                                setIsSupported(false)
                            }}
                            className="text-xs text-white/50 hover:text-white px-2"
                        >
                            Later
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return null // Already subscribed
}
