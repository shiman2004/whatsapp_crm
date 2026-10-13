// Service Worker for Royal Wellness WhatsApp CRM
// Enables native OS Desktop Action Center notifications when browsing other websites or apps.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const leadId = event.notification.data?.leadId;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate to chat
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (leadId) {
            client.postMessage({ type: 'NAVIGATE_TO_LEAD', leadId });
          }
          return;
        }
      }
      // If no window is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
