import { useState, useEffect } from 'react';

/**
 * Hook to detect if screen is mobile size
 * Returns true if screen width < 768px (tablet/mobile)
 * Returns false if screen width >= 768px (desktop/large tablet)
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    // Initial value (for SSR compatibility)
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    // Set initial value on mount
    setIsMobile(window.innerWidth < 768);

    // Handle resize
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}
