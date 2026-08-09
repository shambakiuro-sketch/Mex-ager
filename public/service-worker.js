// Mex ager service worker.
// Notification actions work when a notification is displayed by this service worker.
// Note: a web notification cannot contain an editable text box like a native
// Windows/WhatsApp notification. "Reply" opens the correct conversation.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action || 'open';
  const data = event.notification?.data || {};
  const senderId = data.senderId || '';

  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      const message = {
        type: action === 'reply' ? 'NOTIFICATION_REPLY' : 'NOTIFICATION_OPEN',
        senderId,
        senderName: data.senderName || ''
      };

      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage(message);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        const url = senderId
          ? `/?replyTo=${encodeURIComponent(senderId)}`
          : '/';

        return self.clients.openWindow(url);
      }

      return undefined;
    })
  );
});

self.addEventListener('notificationclose', () => {});
