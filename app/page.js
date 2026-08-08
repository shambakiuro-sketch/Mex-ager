'use client';

import { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Auth from './components/Auth';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('AUTH STATE:', currentUser);
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Checking login...</div>;
  }

  return user ? (
    <div style={{ padding: '40px', fontFamily: 'Arial' }}>
      <h1>Firebase Authentication Works ✅</h1>
      <p>Logged in as: {user.email}</p>
      <p>UID: {user.uid}</p>
    </div>
  ) : (
    <Auth onAuthSuccess={() => setUser(auth.currentUser)} />
  );
}
