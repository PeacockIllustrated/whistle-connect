self.addEventListener('push', function (event) {
    if (event.data) {
        const payload = event.data.json();
        const options = {
            body: payload.body,
            icon: '/icon-192x192.png', // Ensure these icons exist in public/ or update path
            badge: '/badge-72x72.png',
            data: {
                link: payload.link
            }
        };
        event.waitUntil(
            self.registration.showNotification(payload.title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    if (event.notification.data && event.notification.data.link) {
        event.waitUntil(
            clients.openWindow(event.notification.data.link)
        );
    }
});
