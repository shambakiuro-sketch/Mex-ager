// Service Worker for Firebase Cloud Messaging with Reply Action
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging.js');

const firebaseConfig = {
  apiKey: "AIzaSyBV9HZO_PyiD3mWtwgpgUDOxryoVRzJtUE",
  authDomain: "jackson-messaging-app.firebaseapp.com",
  projectId: "jackson-messaging-app",
  storageBucket: "jackson-messaging-app.firebasestorage.app",
  messagingSenderId: "39972249513",
  appId: "1:39972249513:web:babbc9f3ca42c3dee1eeb8",
  databaseURL: "https://jackson-messaging-app-default-rtdb.europe-west1.firebasedatabase.app"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle notification when app is closed/backgrounded
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification.title;
  const senderName = payload.data?.senderName || 'Someone';
  const senderId = payload.data?.senderId || '';
  
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: `message-${senderId}`,
    requireInteraction: true,
    data: {
      senderId: senderId,
      senderName: senderName,
      click_action: 'OPEN_APP'
    },
    actions: [
      {
        action: 'open',
        title: 'Open',
        icon: '/favicon.svg'
      },
      {
        action: 'reply',
        title: 'Reply',
        icon: '/favicon.svg'
      }
    ]
  };
  
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.action);
  
  if (event.action === 'reply') {
    // Open app with reply intent
    event.notification.close();
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_REPLY',
              senderId: event.notification.data.senderId,
              senderName: event.notification.data.senderName
            });
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  } else {
    // Normal open
    event.notification.close();
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed');
});
