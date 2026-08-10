'use client';

import { useState, useEffect } from 'react';
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

    // Register Service Worker for FCM (improved for mobile)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
          
          // Listen for messages from Service Worker (reply action)
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'NOTIFICATION_REPLY') {
              const senderId = event.data.senderId;
              const foundUser = users.find(u => u.uid === senderId);
              if (foundUser) {
                setSelectedUser(foundUser);
              }
            }
          });
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }

    // Load users
    const usersRef = ref(database, 'users');

    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        const data = snapshot.val();

        if (data) {
          const userList = Object.entries(data)
            .map(([uid, userData]) => ({
              uid,
              ...userData
            }))
            .filter((user) => user.uid !== currentAuthUser.uid);

          setUsers(userList);
        } else {
          setUsers([]);
        }

        setLoading(false);
      },
      (error) => {
        console.error('Failed to load users:', error);
        setUsers([]);
        setLoading(false);
      }
    );

    // Save current user's information
    const userRef = ref(
      database,
      `users/${currentAuthUser.uid}`
    );

    set(userRef, {
      displayName: currentAuthUser.displayName || 'Anonymous',
      email: currentAuthUser.email,
      lastSeen: new Date().toISOString()
    }).catch((error) => {
      console.error('Failed to save user:', error);
    });

    // Load dark mode preference
    const savedDarkMode =
      localStorage.getItem('darkMode') === 'true';

    setDarkMode(savedDarkMode);

    // Check notification permission
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }

    return () => unsubscribe();
  }, [users]);

  const handleDarkModeToggle = () => {
    const newMode = !darkMode;

    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode);
  };

  // Request notification permission (improved for mobile)
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Your browser does not support notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
      new Notification('Notifications Already Enabled! 🔔', {
        body: 'You will receive all message notifications',
        icon: '/favicon.svg',
        badge: '/favicon.svg'
      });
      return;
    }

    if (Notification.permission === 'denied') {
      alert('Notifications are blocked. Please enable them in your browser settings.');
      return;
    }

    // Request permission (default state)
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        
        // Test notification
        new Notification('Mex ager Notifications Enabled! 🔔', {
          body: 'You will now receive all message notifications, even when the app is closed!',
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          requireInteraction: false
        });

        // Store preference
        localStorage.setItem('notificationsEnabled', 'true');
      } else if (permission === 'denied') {
        alert('Notifications disabled. You can enable them in browser settings later.');
      }
    } catch (error) {
      console.error('Notification permission error:', error);
      alert('Error requesting notification permission');
    }
  };

  // Show notification when message arrives
  const showMessageNotification = (senderName, messageText, senderId) => {
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      const title = `Message from ${senderName}`;
      const body = messageText.substring(0, 60) + (messageText.length > 60 ? '...' : '');

      new Notification(title, {
        body: body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: `message-${senderId}`,
        requireInteraction: false,
        data: {
          senderId: senderId,
          senderName: senderName
        }
      });
      
      // Increment badge counter
      if ('setAppBadge' in navigator) {
        setMessageCount(prev => prev + 1);
        navigator.setAppBadge(messageCount + 1);
      }
    }
  };

  // Clear badge when opening chat
  const handleSelectUser = (user) => {
    setSelectedUser(user);
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge();
      setMessageCount(0);
    }
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: darkMode ? '#1a1a1a' : '#f0f0f0',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <p
          style={{
            color: darkMode ? '#e0e0e0' : '#333'
          }}
        >
          Loading...
        </p>
      </div>
    );
  }

  const sidebarBg = darkMode ? '#2d2d2d' : '#f0f0f0';
  const sidebarBorder = darkMode ? '#444' : '#ddd';
  const headerBg = darkMode ? '#1a1a1a' : '#667eea';
  const textColor = darkMode ? '#e0e0e0' : '#333';
  const mutedText = darkMode ? '#888' : '#666';

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: darkMode ? '#1a1a1a' : '#fff',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: '300px',
          background: sidebarBg,
          borderRight: `1px solid ${sidebarBorder}`,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem',
            background: headerBg,
            color: 'white',
            borderBottom: `1px solid ${sidebarBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <h2
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1.3rem'
              }}
            >
              Messages
            </h2>

            <p
              style={{
                margin: 0,
                fontSize: '0.9rem',
                opacity: 0.9
              }}
            >
              {currentUser?.displayName ||
                currentUser?.email ||
                'User'}
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

        {/* Notification Button - Improved for Mobile */}
        <div
          style={{
            padding: '0.5rem 1rem',
            borderBottom: `1px solid ${sidebarBorder}`
          }}
        >
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
              fontWeight: 'bold',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
            onMouseLeave={(e) => e.target.style.opacity = '1'}
            title="Works on mobile too! Tap to enable"
          >
            {notificationsEnabled ? '🔔 Notifications ON' : '🔕 Enable Notifications'}
          </button>
          <p
            style={{
              fontSize: '0.75rem',
              color: mutedText,
              margin: '0.5rem 0 0 0',
              textAlign: 'center'
            }}
          >
            Works even when app is closed
          </p>
        </div>

        {/* User List */}
        <UserList
          users={users}
          onSelectUser={handleSelectUser}
          selectedUser={selectedUser}
          darkMode={darkMode}
        />

        {/* Logout */}
        <div
          style={{
            padding: '1rem',
            borderTop: `1px solid ${sidebarBorder}`
          }}
        >
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

      {/* Chat Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {selectedUser ? (
          <ChatWindow
            selectedUser={selectedUser}
            currentUser={currentUser}
            darkMode={darkMode}
            onMessageNotification={showMessageNotification}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: mutedText,
              background: darkMode ? '#1a1a1a' : '#fafafa'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: '3rem',
                  margin: 0
                }}
              >
                💬
              </p>

              <p
                style={{
                  fontSize: '1.1rem',
                  margin: '0.5rem 0 0'
                }}
              >
                Select a user to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
