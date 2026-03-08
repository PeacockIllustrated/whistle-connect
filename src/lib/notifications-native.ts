'use client'

import { PushNotifications } from '@capacitor/push-notifications'
import { createClient } from '@/lib/supabase/client'

/**
 * Initialises native push notifications via Capacitor.
 * Called once when the app mounts inside a native shell.
 *
 * Flow:
 * 1. Request permission from the OS
 * 2. Register with FCM (Android) or APNs (iOS)
 * 3. Receive a device token
 * 4. Store the token in push_subscriptions with platform='firebase'
 * 5. Listen for incoming push notifications
 */
export async function initNativePush(): Promise<void> {
    // 1. Check and request permission
    let permStatus = await PushNotifications.checkPermissions()

    if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions()
    }

    if (permStatus.receive !== 'granted') {
        console.warn('[NativePush] Permission not granted')
        return
    }

    // 2. Register for push (triggers FCM/APNs registration)
    await PushNotifications.register()

    // 3. Handle successful registration — save token
    PushNotifications.addListener('registration', async (token) => {
        console.log('[NativePush] Token received:', token.value.slice(0, 12) + '...')
        await saveNativeToken(token.value)
    })

    // 4. Handle registration errors
    PushNotifications.addListener('registrationError', (error) => {
        console.error('[NativePush] Registration error:', error)
    })

    // 5. Handle foreground notifications
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[NativePush] Foreground:', notification.title)
        // The native OS shows the notification automatically
        // due to presentationOptions in capacitor.config.ts
    })

    // 6. Handle notification tap (user opened a notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data

        // Navigate to the deep link if provided
        if (data?.link) {
            window.location.href = data.link
        }
    })
}

/**
 * Saves the FCM/APNs device token to Supabase.
 * Deletes stale tokens first to handle token refresh (new token ≠ old token).
 */
async function saveNativeToken(token: string): Promise<void> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.warn('[NativePush] Cannot save token: user not authenticated')
        return
    }

    // Remove any stale Firebase tokens for this user first
    // (handles token refresh where the new token is different)
    await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('platform', 'firebase')

    // Insert the fresh token
    const { error } = await supabase.from('push_subscriptions').insert({
        user_id: user.id,
        endpoint: token,
        p256dh: null,
        auth: null,
        platform: 'firebase',
    })

    if (error) {
        console.error('[NativePush] Failed to save token:', error)
    }
}

/**
 * Removes all native push tokens for the current user.
 * Call this on logout to clean up.
 */
export async function removeNativeTokens(): Promise<void> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('platform', 'firebase')
}
