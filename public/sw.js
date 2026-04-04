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

// Tag groups prevent notification flood — same-type notifs replace each other
const TAG_MAP = {
    sos:       'wc-sos',
    booking:   'wc-booking',
    offer:     'wc-offer',
    message:   'wc-message',
    default:   'wc-general',
};

function getTag(payload) {
    if (payload.urgency === 'sos' || (payload.title && payload.title.includes('SOS'))) return TAG_MAP.sos;
    if (payload.title && (payload.title.includes('Booking') || payload.title.includes('Match'))) return TAG_MAP.booking;
    if (payload.title && (payload.title.includes('Offer') || payload.title.includes('Price'))) return TAG_MAP.offer;
    if (payload.type === 'info') return TAG_MAP.default;
    return TAG_MAP.default;
}

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

    const isSOS = payload.urgency === 'sos' || (payload.title && payload.title.includes('SOS'));
    const tag = getTag(payload);

    const options = {
        body: payload.body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: tag,
        renotify: true,             // Vibrate/sound even when replacing same tag
        timestamp: Date.now(),
        data: {
            link: payload.link || '/app',
            type: payload.type || 'info',
        },
    };

    // SOS: urgent, sticky, with action buttons and vibration
    if (isSOS) {
        options.requireInteraction = true;
        options.vibrate = [200, 100, 200, 100, 200];
        options.tag = TAG_MAP.sos + '-' + Date.now(); // Don't collapse SOS — each one matters
        options.actions = [
            { action: 'claim', title: 'Claim Match' },
            { action: 'pass', title: 'Pass' },
        ];
    }

    // Success notifications (confirmed, completed): short vibration
    if (payload.type === 'success') {
        options.vibrate = [100, 50, 100];
    }

    // Warning notifications (pullout, cancellation): longer vibration
    if (payload.type === 'warning' && !isSOS) {
        options.vibrate = [150, 75, 150];
    }

    event.waitUntil(
        self.registration.showNotification(payload.title || 'Whistle Connect', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const link = event.notification.data?.link || '/app';

    // "Pass" action on SOS: just dismiss
    if (event.action === 'pass') return;

    // For all other clicks (including "Claim"): navigate to the link
    // Try to focus an existing app window instead of opening a new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Find an existing Whistle Connect window
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.navigate(link);
                    return;
                }
            }
            // No existing window — open a new one
            return clients.openWindow(link);
        })
    );
});
