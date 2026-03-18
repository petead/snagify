// Dedicated Push Notifications Service Worker
// This SW handles only push notifications alongside the main next-pwa SW

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Snagify', body: event.data.text() };
  }
  const { title = 'Snagify', body = '', icon, url } = data;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icon-192x192.png',
      badge: '/icon-72x72.png',
      data: { url: url || '/' },
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Required: SW must not intercept fetches (let next-pwa handle that)
self.addEventListener('fetch', () => {});
