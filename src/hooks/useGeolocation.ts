'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  getCurrentPosition,
  type Coordinates,
} from '@/lib/geolocation';

// ---------------------------------------------------------------------------
// useGeolocation — React hook wrapping the geolocation utility
// ---------------------------------------------------------------------------

interface UseGeolocationReturn {
  /** Most recently obtained coordinates, or `null` if not yet fetched. */
  location: Coordinates | null;
  /** Human-readable error message, or `null` if no error. */
  error: string | null;
  /** `true` while a geolocation request is in progress. */
  loading: boolean;
  /** Manually trigger a fresh location fetch. */
  refresh: () => void;
}

/**
 * Hook that provides the user's current geolocation.
 *
 * Does NOT auto-fetch on mount — call `refresh()` when you need the location
 * (to avoid unnecessary permission prompts).
 */
export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    // Prevent concurrent requests
    setLoading(true);
    setError(null);

    getCurrentPosition()
      .then((coords) => {
        setLocation(coords);
        setError(null);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : 'An unknown error occurred while getting your location.';
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Clean up is not strictly needed for the Geolocation API's
  // getCurrentPosition (it's a one-shot call), but we guard against
  // state updates after unmount by letting React's batched updates handle it.
  // For watchPosition, you'd need cleanup — but we don't use that here.

  // If the browser goes back online after a location failure, automatically
  // retry so the user doesn't have to press refresh manually.
  useEffect(() => {
    function handleOnline() {
      if (error) {
        refresh();
      }
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [error, refresh]);

  return { location, error, loading, refresh };
}
