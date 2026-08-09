'use client';

import { useEffect, useState } from 'react';
import { auth, database } from '../lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { signOut } from 'firebase/auth';
import UserList from './UserList';
import ChatWindow from './ChatWindow';

export default function Chat() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    const currentAuthUser = auth.currentUser;

    if (!currentAuthUser) {
      setLoading(false);
      return;
    }

    setCurrentUser(currentAuthUser);

    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);

    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }

    // Use the service worker that actually exists in /public.
    let serviceWorkerCleanup = null;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(() => {
          const handler = (event) => {
            if (event.data?.type !== 'NOTIFICATION_REPLY') return;

            const senderId = event.data.senderId;
            const foundUser = users.find((u) => u.uid === senderId);

            if (foundUser) {
              setSelectedUser(foundUser);
            } else {
              // The URL is also used so a later users-list refresh can select it.
              sessionStorage.setItem('pendingReplySenderId', senderId || '');
            }
          };

          navigator.serviceWorker.addEventListener('message', handler);
          serviceWorkerCleanup = () => {
            navigator.serviceWorker.removeEventListener('message', handler);
          };
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }

    const usersRef = ref(database, 'users');

    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        const data = snapshot.val();

        const userList = data
          ? Object.entries(data)
              .map(([uid, userData]) => ({ uid, ...userData }))
              .filter((user) => user.uid !== currentAuthUser.uid)
          : [];

        setUsers(userList);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to load users:', error);
        setUsers([]);
        setLoading(false);
      }
    );

    const userRef = ref(database, `users/${currentAuthUser.uid}`);

    set(userRef, {
      displayName: currentAuthUser.displayName || 'Anonymous',
      email: currentAuthUser.email,
      lastSeen: new Date().toISOString()
    }).catch((error) => {
      console.error('Failed to save user:', error);
    });

    return () => {
      unsubscribe();
      serviceWorkerCleanup?.();
    };
  }, []);

  // Select a user after the users list has loaded, including notification replies.
  useEffect(() => {
    const pendingSenderId = sessionStorage.getItem('pendingReplySenderId');
    if (!pendingSenderId || users.length === 0) return;

    const foundUser = users.find((u) => u.uid === pendingSenderId);

    if (foundUser) {
      setSelectedUser(foundUser);
      sessionStorage.removeItem('pendingReplySenderId');
    }
  }, [users]);

  const handleDarkModeToggle = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications.');
      return;
    }

    if (Notification.permission === 'denied') {
      alert('Notifications are blocked. Enable them in your browser/site settings.');
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      setNotificationsEnabled(true);

      const registration = await navigator.serviceWorker?.ready;
      if (registration) {
        registration.showNotification('Mex ager Notifications Enabled 🔔', {
          body: 'You will receive message alerts while this browser is available.',
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: 'mex-ager-notifications'
        });
      }
    }
  };

  const showMessageNotification = async (senderName, messageText, senderId) => {
    if (!notificationsEnabled || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;

    const registration = await navigator.serviceWorker?.ready;

    const options = {
      body: messageText,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: `message-${senderId}`,
      requireInteraction: true,
      data: {
        senderId,
        senderName
      },
      actions: [
        { action: 'reply', title: 'Reply' },
        { action: 'open', title: 'Open' }
      ]
    };

    if (registration) {
      await registration.showNotification(`Message from ${senderName}`, options);
    } else {
      new Notification(`Message from ${senderName}`, options);
    }

    if ('setAppBadge' in navigator) {
      const nextCount = messageCount + 1;
      setMessageCount(nextCount);
      navigator.setAppBadge(nextCount);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);

    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }

    setMessageCount(0);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: darkMode ? '#1a1a1a' : '#f0f0f0',
        fontFamily: 'Arial, sans-serif'
      }}>
        <p style={{ color: darkMode ? '#e0e0e0' : '#333' }}>Loading...</p>
      </div>
    );
  }

  const sidebarBg = darkMode ? '#2d2d2d' : '#f0f0f0';
  const sidebarBorder = darkMode ? '#444' : '#ddd';
  const headerBg = darkMode ? '#1a1a1a' : '#667eea';
  const mutedText = darkMode ? '#888' : '#666';

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: darkMode ? '#1a1a1a' : '#fff',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        width: '300px',
        background: sidebarBg,
        borderRight: `1px solid ${sidebarBorder}`,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '1rem',
          background: headerBg,
          color: 'white',
          borderBottom: `1px solid ${sidebarBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem' }}>Messages</h2>
            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>
              {currentUser?.displayName || currentUser?.email || 'User'}
            </p>
          </div>

          <button
            onClick={handleDarkModeToggle}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '0.5rem',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        <div style={{
          padding: '0.5rem 1rem',
          borderBottom: `1px solid ${sidebarBorder}`
        }}>
          <button
            onClick={requestNotificationPermission}
            style={{
              width: '100%',
              padding: '0.7rem',
              background: notificationsEnabled ? '#4CAF50' : '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 'bold'
            }}
          >
            {notificationsEnabled ? '🔔 Notifications ON' : '🔕 Enable Notifications'}
          </button>
          <p style={{
            fontSize: '0.75rem',
            color: mutedText,
            margin: '0.5rem 0 0',
            textAlign: 'center'
          }}>
            Reply action opens the matching chat
          </p>
        </div>

        <UserList
          users={users}
          onSelectUser={handleSelectUser}
          selectedUser={selectedUser}
          darkMode={darkMode}
        />

        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${sidebarBorder}`
        }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.8rem',
              background: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {selectedUser ? (
          <ChatWindow
            selectedUser={selectedUser}
            currentUser={currentUser}
            darkMode={darkMode}
            onMessageNotification={showMessageNotification}
          />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: mutedText,
            background: darkMode ? '#1a1a1a' : '#fafafa'
          }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '3rem', margin: 0 }}>💬</p>
              <p style={{ fontSize: '1.1rem', margin: '0.5rem 0 0' }}>
                Select a user to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
