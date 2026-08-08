// Service Worker for Firebase Cloud Messaging
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
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'message-notification',
    requireInteraction: false,
    data: payload.data
  };
  
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
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
});
