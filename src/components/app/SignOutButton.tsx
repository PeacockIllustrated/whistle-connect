'use client'

import { signOut } from '@/lib/auth/actions'
import { isNative } from '@/lib/platform'
import { removeNativeTokens } from '@/lib/notifications-native'

export function SignOutButton() {
    async function handleSignOut() {
        // Clean up native push tokens before signing out
        if (isNative()) {
            await removeNativeTokens()
        }
        await signOut()
    }

    return (
        <form action={handleSignOut}>
            <button
                type="submit"
                className="w-full p-4 rounded-2xl border-2 border-red-200 text-red-600 font-semibold text-center hover:bg-red-50 transition-colors"
            >
                Sign Out
            </button>
        </form>
    )
}
