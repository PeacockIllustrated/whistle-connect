# Native Push Notifications Setup

Whistle Connect uses **Capacitor** to wrap the web app as a native Android/iOS app, and **Firebase Cloud Messaging (FCM)** as the free push delivery service. Supabase remains your entire backend — FCM is just the postman.

## What's Already Done (in the codebase)

- Capacitor config with push notification plugin
- Android + iOS native project shells generated
- `notifications-native.ts` — registers device token, saves to Supabase
- `firebase-admin.ts` — sends push via FCM HTTP v1 API (zero dependencies)
- `notifications.ts` — dispatches to both web push AND FCM automatically
- Platform detection (`isNative()`) branches the push flow automatically

## Step 1: Create a Firebase Project (5 minutes, free)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create a project"**
3. Name it `whistle-connect` (or anything)
4. Disable Google Analytics (not needed)
5. Click **Create**

## Step 2: Add Android App to Firebase

1. In the Firebase console, click **"Add app"** > **Android**
2. Package name: `com.whistleconnect.app`
3. App nickname: `Whistle Connect`
4. Skip the SHA-1 for now (needed later for production)
5. Click **Register app**
6. Download `google-services.json`
7. Place it in: `android/app/google-services.json`

## Step 3: Add iOS App to Firebase (optional, for iOS builds)

1. Click **"Add app"** > **iOS**
2. Bundle ID: `com.whistleconnect.app`
3. Download `GoogleService-Info.plist`
4. Place it in: `ios/App/App/GoogleService-Info.plist`

## Step 4: Get a Service Account Key

1. In the Firebase console, go to **Project Settings** > **Service Accounts**
2. Click **"Generate new private key"**
3. Download the JSON file
4. Set the ENTIRE contents as an environment variable:

**In Vercel:**
- Go to your project settings > Environment Variables
- Name: `FIREBASE_SERVICE_ACCOUNT`
- Value: paste the entire JSON content (one line)

**In `.env.local` (for local dev):**
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"whistle-connect","client_email":"...","private_key":"..."}
```

## Step 5: Build and Test

```bash
# Sync web assets to native projects
npx cap sync

# Open in Android Studio
npx cap open android

# Or run directly on a connected Android device
npx cap run android
```

For iOS (requires macOS + Xcode):
```bash
npx cap open ios
```

## How It Works

```
User action (e.g. coach sends offer)
  → Server calls createNotification()
    → Inserts into Supabase notifications table (in-app bell)
    → Fetches push_subscriptions for the target user
    → Web subscriptions → sent via web-push (VAPID)
    → Firebase subscriptions → sent via FCM HTTP v1 API
      → FCM delivers to Android/iOS device
      → Device shows native notification even when app is closed
```

## Troubleshooting

**"Firebase not configured" in logs:**
- The `FIREBASE_SERVICE_ACCOUNT` env var is not set or is malformed
- Ensure it's valid JSON with `project_id`, `client_email`, and `private_key`

**Notifications work in-app but not on device:**
- Check the device has granted notification permission
- Check Supabase `push_subscriptions` table has a `platform='firebase'` row for the user
- Check Vercel function logs for FCM errors

**Token refresh:**
- When the FCM token changes (happens periodically), `notifications-native.ts` deletes the old token and saves the new one automatically
