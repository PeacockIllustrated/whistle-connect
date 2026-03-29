'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { NotificationCategory } from '@/lib/notifications'

// ── Notification Queries ────────────────────────────────────────────────

export async function getNotifications(
    limit = 30,
    offset = 0,
    category?: NotificationCategory,
    unreadOnly = false,
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized', data: null }

    let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (category) {
        query = query.eq('category', category)
    }

    if (unreadOnly) {
        query = query.eq('is_read', false)
    }

    const { data, error } = await query

    if (error) return { error: error.message, data: null }
    return { data, error: null }
}

export async function getUnreadCount() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { count: 0 }

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

    if (error) return { count: 0 }
    return { count: count || 0 }
}

export async function markNotificationAsRead(notificationId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/app/notifications')
    return { success: true }
}

export async function markAllNotificationsAsRead(category?: NotificationCategory) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    let query = supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

    if (category) {
        query = query.eq('category', category)
    }

    const { error } = await query

    if (error) return { error: error.message }

    revalidatePath('/app/notifications')
    return { success: true }
}

export async function deleteNotification(notificationId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/app/notifications')
    return { success: true }
}

export async function clearAllNotifications() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('is_read', true) // Only clear read notifications

    if (error) return { error: error.message }

    revalidatePath('/app/notifications')
    return { success: true }
}

// ── Notification Preferences ────────────────────────────────────────────

export interface NotificationPreference {
    category: NotificationCategory
    in_app: boolean
    push: boolean
}

const ALL_CATEGORIES: NotificationCategory[] = [
    'booking_update',
    'offer_update',
    'match_reminder',
    'new_match_nearby',
    'sos_alert',
    'message',
    'verification',
    'rating',
    'system',
]

const CATEGORY_LABELS: Record<NotificationCategory, { label: string; description: string }> = {
    booking_update: {
        label: 'Booking Updates',
        description: 'Booking confirmations, cancellations, and completions',
    },
    offer_update: {
        label: 'Offer Updates',
        description: 'New offers, acceptances, declines, and withdrawals',
    },
    match_reminder: {
        label: 'Match Reminders',
        description: 'Reminders before your upcoming matches',
    },
    new_match_nearby: {
        label: 'New Matches Nearby',
        description: 'When a new booking is created near you',
    },
    sos_alert: {
        label: 'SOS Alerts',
        description: 'Urgent last-minute match referee requests',
    },
    message: {
        label: 'Messages',
        description: 'New messages in your conversations',
    },
    verification: {
        label: 'Verification',
        description: 'FA number and account verification updates',
    },
    rating: {
        label: 'Ratings',
        description: 'New ratings received from coaches',
    },
    system: {
        label: 'System',
        description: 'Important system announcements',
    },
}

export { CATEGORY_LABELS, ALL_CATEGORIES }

export async function getNotificationPreferences(): Promise<{
    data?: NotificationPreference[]
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { data: savedPrefs, error } = await supabase
        .from('notification_preferences')
        .select('category, in_app, push')
        .eq('user_id', user.id)

    if (error) return { error: error.message }

    // Merge saved preferences with defaults (all enabled)
    const prefsMap = new Map(
        (savedPrefs || []).map(p => [p.category, p])
    )

    const preferences: NotificationPreference[] = ALL_CATEGORIES.map(cat => ({
        category: cat,
        in_app: prefsMap.get(cat)?.in_app ?? true,
        push: prefsMap.get(cat)?.push ?? true,
    }))

    return { data: preferences }
}

export async function updateNotificationPreference(
    category: NotificationCategory,
    updates: { in_app?: boolean; push?: boolean },
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    const { error } = await supabase
        .from('notification_preferences')
        .upsert(
            {
                user_id: user.id,
                category,
                in_app: updates.in_app ?? true,
                push: updates.push ?? true,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id, category' }
        )

    if (error) return { error: error.message }

    revalidatePath('/app/notifications')
    return { success: true }
}
