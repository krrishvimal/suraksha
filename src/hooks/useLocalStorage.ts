'use client';

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// useLocalStorage — generic hook that syncs React state with localStorage
// ---------------------------------------------------------------------------

/**
 * A React hook that persists state in `localStorage`.
 *
 * - SSR-safe: falls back to `initialValue` on the server.
 * - Handles JSON serialisation / deserialisation.
 * - Syncs across tabs via the `storage` event.
 *
 * @param key          The localStorage key.
 * @param initialValue Fallback value when nothing is stored yet.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // -----------------------------------------------------------------------
  // Lazy initialiser — only reads localStorage once, on mount
  // -----------------------------------------------------------------------
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initialValue;
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  // -----------------------------------------------------------------------
  // Setter — updates both React state and localStorage
  // -----------------------------------------------------------------------
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue =
          value instanceof Function ? value(prev) : value;

        try {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
        } catch (error: unknown) {
          console.error(
            `[useLocalStorage] Failed to write "${key}":`,
            error instanceof Error ? error.message : error,
          );
        }

        return nextValue;
      });
    },
    [key],
  );

  // -----------------------------------------------------------------------
  // Remove — deletes the key from localStorage and resets to initialValue
  // -----------------------------------------------------------------------
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Silently ignore
    }
    setStoredValue(initialValue);
  }, [key, initialValue]);

  // -----------------------------------------------------------------------
  // Cross-tab sync via the `storage` event
  // -----------------------------------------------------------------------
  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key !== key) return;

      if (event.newValue === null) {
        setStoredValue(initialValue);
        return;
      }

      try {
        setStoredValue(JSON.parse(event.newValue) as T);
      } catch {
        setStoredValue(initialValue);
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}
