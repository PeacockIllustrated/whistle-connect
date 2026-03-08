import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
    appId: 'com.whistleconnect.app',
    appName: 'Whistle Connect',
    webDir: 'out',
    server: {
        // Live server URL — the native app loads the Vercel deployment in a WebView.
        // All Server Actions, SSR, and middleware work as-is.
        // For local development, change to: 'http://192.168.x.x:3000' and set cleartext: true
        url: 'https://whistle-connect.vercel.app',
        cleartext: false,
    },
    plugins: {
        PushNotifications: {
            presentationOptions: ['badge', 'sound', 'alert'],
        },
    },
    ios: {
        contentInset: 'automatic',
        scheme: 'Whistle Connect',
    },
    android: {
        allowMixedContent: false,
    },
}

export default config
