const CACHE_NAME = 'whistle-connect-v1';
const STATIC_ASSETS = [
    '/offline',
    '/icon-192x192.png',
    '/icon-512x512.png',
];

// ── Install: pre-cache static assets ─────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            // Cache each asset individually so one failure doesn't block SW activation
            Promise.allSettled(
                STATIC_ASSETS.map((url) =>
                    cache.add(url).catch((err) =>
                        console.warn('[SW] Failed to cache', url, err)
                    )
                )
            )
        )
    );
    self.skipWaiting();
});

// ── Activate: clean old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for static ────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Supabase/API requests — network only
    if (url.hostname.includes('supabase') || url.pathname.startsWith('/api/')) {
        return;
    }

    // Static assets (JS, CSS, images, fonts): cache-first
    if (
        url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|ico|woff2?|ttf)$/) ||
        url.pathname.startsWith('/_next/static/')
    ) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Navigation requests: network-first with offline fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match('/offline').then((cached) => cached || new Response('Offline', { status: 503 }))
            )
        );
        return;
    }
});

// ── Push Notifications ───────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    if (!event.data) {
        console.warn('[SW] Push received with no data');
        return;
    }

    let payload;
    try {
        payload = event.data.json();
    } catch (e) {
        console.error('[SW] Failed to parse push payload:', e);
        payload = { title: 'Whistle Connect', body: event.data.text() };
    }

    const isSOS = payload.title?.includes('SOS') || payload.urgency === 'sos';

    const options = {
        body: payload.body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        data: {
            link: payload.link || '/app',
        },
        // SOS notifications are more urgent
        ...(isSOS && {
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 200],
            tag: 'sos-' + Date.now(),
            actions: [
                { action: 'claim', title: 'Claim Match' },
                { action: 'pass', title: 'Pass' },
            ],
        }),
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const link = event.notification.data?.link || '/app';

    // Handle SOS action buttons
    if (event.action === 'claim') {
        event.waitUntil(clients.openWindow(link));
        return;
    }

    if (event.action === 'pass') {
        // Just close — do nothing
        return;
    }

    // Default: open the link
    event.waitUntil(clients.openWindow(link));
});
