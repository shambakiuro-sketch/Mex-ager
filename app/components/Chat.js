'use client';

import { useState, useEffect } from 'react';
import { auth, database } from '../lib/firebase';
import { ref, onValue, push, set } from 'firebase/database';
import { signOut } from 'firebase/auth';
import UserList from './UserList';
import ChatWindowEnhanced from './ChatWindow';

export default function Chat() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setCurrentUser(auth.currentUser);
    
    // Load all users
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userList = Object.entries(data).map(([uid, userData]) => ({
          uid,
          ...userData
        })).filter(user => user.uid !== auth.currentUser.uid);
        setUsers(userList);
      }
      setLoading(false);
    });

    // Save current user info
    if (auth.currentUser) {
      const userRef = ref(database, `users/${auth.currentUser.uid}`);
      set(userRef, {
        displayName: auth.currentUser.displayName || 'Anonymous',
        email: auth.currentUser.email,
        lastSeen: new Date().toISOString()
      });
    }

    // Load dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
  }, []);

  const handleDarkModeToggle = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('darkMode', !darkMode);
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: darkMode ? '#1a1a1a' : '#f0f0f0'
      }}>
        <p style={{ color: darkMode ? '#e0e0e0' : '#333' }}>Loading...</p>
      </div>
    );
  }

  const sidebarBg = darkMode ? '#2d2d2d' : '#f0f0f0';
  const sidebarBorder = darkMode ? '#444' : '#ddd';
  const headerBg = darkMode ? '#1a1a1a' : '#667eea';
  const headerText = 'white';
  const textColor = darkMode ? '#e0e0e0' : '#333';
  const mutedText = darkMode ? '#888' : '#666';

  return (
    <div style={{ display: 'flex', height: '100vh', background: darkMode ? '#1a1a1a' : '#fff' }}>
      {/* Sidebar */}
      <div style={{
        width: '300px',
        background: sidebarBg,
        borderRight: `1px solid ${sidebarBorder}`,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem',
          background: headerBg,
          color: headerText,
          borderBottom: `1px solid ${sidebarBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem' }}>Messages</h2>
            <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.9 }}>
              {currentUser?.displayName || currentUser?.email}
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

        {/* User List */}
        <UserList users={users} onSelectUser={setSelectedUser} selectedUser={selectedUser} darkMode={darkMode} />

        {/* Logout Button */}
        <div style={{
          padding: '1rem',
          borderTop: `1px solid ${sidebarBorder}`,
          display: 'flex',
          gap: '0.5rem'
        }}>
          <button
            onClick={handleLogout}
            style={{
              flex: 1,
              padding: '0.8rem',
              background: '#e74c3c',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#c0392b'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#e74c3c'}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedUser ? (
          <ChatWindowEnhanced selectedUser={selectedUser} currentUser={currentUser} darkMode={darkMode} />
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
              <p style={{ fontSize: '3rem', margin: '0' }}>💬</p>
              <p style={{ fontSize: '1.1rem', margin: '0.5rem 0 0 0' }}>Select a user to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
