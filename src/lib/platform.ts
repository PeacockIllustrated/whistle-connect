'use client'

import { Capacitor } from '@capacitor/core'

export type Platform = 'web' | 'android' | 'ios'

/**
 * Detects the current runtime platform.
 * Returns 'android' or 'ios' inside a Capacitor native shell,
 * 'web' for all browser/PWA contexts.
 */
export function getPlatform(): Platform {
    if (typeof window === 'undefined') return 'web'

    if (Capacitor.isNativePlatform()) {
        const platform = Capacitor.getPlatform()
        if (platform === 'android') return 'android'
        if (platform === 'ios') return 'ios'
    }

    return 'web'
}

/** True when running inside a Capacitor native shell (Android or iOS). */
export function isNative(): boolean {
    if (typeof window === 'undefined') return false
    return Capacitor.isNativePlatform()
}

/** True when running in a regular web browser or PWA. */
export function isWeb(): boolean {
    return !isNative()
}
