'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isNative } from '@/lib/platform'
import { initNativePush } from '@/lib/notifications-native'

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

    // Declared first (used by registerServiceWorker and subscribe). useCallback gives
    // a stable reference so the effect dependencies don't churn.
    const saveSubscription = useCallback(async (sub: PushSubscription) => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            console.error('[Push] Cannot save subscription: user not authenticated')
            return
        }

        const p256dh = sub.toJSON().keys?.p256dh
        const auth = sub.toJSON().keys?.auth

        if (!p256dh || !auth) {
            console.error('[Push] Subscription missing VAPID keys:', { p256dh: !!p256dh, auth: !!auth })
            return
        }

        const { error } = await supabase.from('push_subscriptions').upsert({
            user_id: user.id,
            endpoint: sub.endpoint,
            p256dh,
            auth,
            platform: 'web',
        }, { onConflict: 'user_id, endpoint' })

        if (error) {
            console.error('[PushNotification] Failed to save subscription:', error)
        } else {
            console.log('[PushNotification] Subscription saved successfully')
        }
    }, [])

    const registerServiceWorker = useCallback(async () => {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none',
        })
        const sub = await registration.pushManager.getSubscription()
        const currentPermission = Notification.permission

        if (sub) {
            // Re-save on every load to ensure the DB always has the current subscription
            // (handles cases where the DB record was lost, e.g. cleanup, migration, etc.)
            await saveSubscription(sub)
            setSubscription(sub)
        } else if (currentPermission === 'granted' && VAPID_PUBLIC_KEY) {
            // Permission already granted but subscription was lost — silently re-subscribe
            try {
                const newSub = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                })
                await saveSubscription(newSub)
                setSubscription(newSub)
            } catch (err) {
                console.error('[Push] Silent re-subscribe failed:', err)
            }
        }

        setPermission(currentPermission)

        // Only show the enable-prompt UI when the user has never made a decision.
        // If permission is 'granted' we silently (re)subscribed above; if 'denied' we can't act.
        if (currentPermission === 'default') {
            const dismissed = localStorage.getItem('notifications_dismissed')
            const recentlyDismissed = dismissed && Date.now() - Number(dismissed) < 24 * 60 * 60 * 1000
            if (!recentlyDismissed) {
                setIsSupported(true)
            }
        }
    }, [VAPID_PUBLIC_KEY, saveSubscription])

    useEffect(() => {
        // Native path: delegate to Capacitor push (FCM/APNs)
        if (isNative()) {
            initNativePush()
            return // Skip all web push logic — native handles its own permissions UI
        }

        // Web path: this effect is the textbook case described in React's docs
        // ("Subscribe for updates from some external system, calling setState in a
        // callback function when external state changes") — service worker registration
        // is the external system. State updates happen asynchronously after navigator
        // / Notification APIs resolve, not synchronously in the effect body.
        if ('serviceWorker' in navigator && 'PushManager' in window && VAPID_PUBLIC_KEY) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            void registerServiceWorker()
        }
    }, [VAPID_PUBLIC_KEY, registerServiceWorker])


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

    if (!isSupported) return null

    // Require explicit user interaction, maybe show a small prompt
    if (permission === 'denied') {
        return null // Can't do anything
    }

    if (!subscription) {
        return (
            <div className="fixed bottom-[calc(var(--bottom-nav-height,72px)+16px)] left-4 right-4 z-50 mx-auto max-w-[var(--content-max-width,480px)] animate-in fade-in slide-in-from-bottom-5 duration-500">
                <div className="rounded-[var(--radius-lg,14px)] bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] p-4 shadow-[var(--shadow-xl)] border border-white/10">
                    <div className="flex items-start gap-3">
                        {/* Bell icon */}
                        <div className="flex-shrink-0 mt-0.5 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">Enable Notifications</p>
                            <p className="text-xs text-white/70 mt-0.5">Get instant updates about bookings, messages and match offers.</p>
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={subscribe}
                                    className="bg-white text-[var(--brand-primary)] font-semibold text-sm px-4 py-2 rounded-[var(--radius-md,10px)] transition-all duration-200 hover:bg-white/90 hover:shadow-md active:scale-[0.97]"
                                >
                                    Enable
                                </button>
                                <button
                                    onClick={() => {
                                        localStorage.setItem('notifications_dismissed', Date.now().toString())
                                        setIsSupported(false)
                                    }}
                                    className="text-sm text-white/60 hover:text-white px-3 py-2 transition-colors duration-200"
                                >
                                    Later
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return null // Already subscribed
}
