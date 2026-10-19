// ---------------------------------------------------------------------------
// localStorage helpers — SSR-safe with full error handling
// ---------------------------------------------------------------------------

/**
 * Enum of all localStorage keys used by the app.
 * Centralised here to avoid magic strings and key collisions.
 */
export enum StorageKeys {
  EMERGENCY_CARD = 'suraksha_emergency_card',
  SOS_CONTACTS = 'suraksha_sos_contacts',
  CHECKIN_UUID = 'suraksha_checkin_uuid',
  CHECKIN_PASSCODE = 'suraksha_checkin_passcode',
  CHECKIN_INTERVAL = 'suraksha_checkin_interval',
  QUEUED_CHECKIN = 'suraksha_queued_checkin',
  LANGUAGE = 'suraksha_language',
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__suraksha_ls_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read a value from localStorage and parse it as JSON.
 *
 * Returns `null` when:
 * - running on the server (SSR)
 * - the key does not exist
 * - the stored value cannot be parsed as JSON
 */
export function getItem<T>(key: string): T | null {
  if (!isLocalStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted data — remove it so it doesn't keep causing errors
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing we can do
    }
    return null;
  }
}

/**
 * Serialise `value` as JSON and write it to localStorage.
 *
 * Silently does nothing during SSR or if localStorage is unavailable.
 */
export function setItem<T>(key: string, value: T): void {
  if (!isLocalStorageAvailable()) return;
  try {
    const serialised = JSON.stringify(value);
    window.localStorage.setItem(key, serialised);
  } catch (error: unknown) {
    // Quota exceeded or other write failure
    console.error(
      `[storage] Failed to write key "${key}":`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Remove a key from localStorage.
 *
 * Silently does nothing during SSR or if localStorage is unavailable.
 */
export function removeItem(key: string): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error: unknown) {
    console.error(
      `[storage] Failed to remove key "${key}":`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Emergency Panic Wipe: Permanently wipes all locally cached emergency contacts,
 * medical QR card records, and active safety check-in tokens from the device.
 */
export function purgeAllLocalData(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    Object.values(StorageKeys).forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch (error: unknown) {
    console.error(
      '[storage] Emergency wipe failure:',
      error instanceof Error ? error.message : error
    );
  }
}

