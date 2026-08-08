'use client';

import { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Auth from './components/Auth';
import Chat from './components/Chat';

export default function Home() {
  console.log("🔥 Firebase Auth object:", auth);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
  console.log("🔥 AUTH STATE FIRED:", currentUser);
  setUser(currentUser);
  setLoading(false);
});

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#f0f0f0'
        }}
      >
        Loading...
      </div>
    );
  }

  return user ? (
    <Chat user={user} />
  ) : (
    <Auth onAuthSuccess={() => setUser(auth.currentUser)} />
  );
}
