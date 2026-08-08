'use client';

import { useEffect, useState } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function Home() {
  const [status, setStatus] = useState('Starting...');

  useEffect(() => {
    setStatus('Firebase loaded. Waiting for Auth...');

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('AUTH CALLBACK:', user);
      setStatus(user ? 'USER IS LOGGED IN' : 'NO USER IS LOGGED IN');
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{
      padding: '50px',
      fontFamily: 'Arial',
      fontSize: '24px'
    }}>
      {status}
    </div>
  );
}
