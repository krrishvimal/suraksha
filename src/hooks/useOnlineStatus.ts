'use client';

import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// useOnlineStatus — React hook that tracks navigator.onLine
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the browser has network connectivity and `false` when
 * it is offline.
 *
 * - SSR-safe: defaults to `true` on the server.
 * - Listens to the `online` and `offline` window events for real-time updates.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    function goOnline() {
      setIsOnline(true);
    }

    function goOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Sync in case the value changed between render and effect
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
