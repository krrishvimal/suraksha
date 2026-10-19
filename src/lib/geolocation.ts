// ---------------------------------------------------------------------------
// Geolocation utilities — browser API wrappers with error handling
// ---------------------------------------------------------------------------

export interface Coordinates {
  lat: number;
  lng: number;
}

/** User-friendly error messages for geolocation failures. */
const ERROR_MESSAGES: Record<number, string> = {
  1: 'Location permission denied. Please allow location access in your browser settings and try again.',
  2: "Location unavailable. Please make sure your device's location services are turned on.",
  3: 'Location request timed out. Please try again.',
};

const GEOLOCATION_TIMEOUT_MS = 10_000;

/**
 * Custom error thrown specifically when geolocation permission was blocked/denied by browser or user.
 */
export class GeolocationPermissionError extends Error {
  readonly code = 1;
  constructor(message = ERROR_MESSAGES[1]) {
    super(message);
    this.name = 'GeolocationPermissionError';
  }
}

/**
 * Query browser location permission state without triggering a prompt.
 */
export async function checkLocationPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (typeof navigator === 'undefined' || !('permissions' in navigator) || !navigator.permissions?.query) {
    return 'unsupported';
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return status.state;
  } catch {
    return 'unsupported';
  }
}

/**
 * Get the user's current position using the browser Geolocation API.
 *
 * - Timeout: 10 seconds
 * - High accuracy enabled (GPS when available)
 * - Returns a typed `Coordinates` object
 * - Throws a descriptive Error on failure
 */
export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise<Coordinates>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(
        new Error(
          'Geolocation is not supported by your browser. Please use a modern browser with location services.',
        ),
      );
      return;
    }

    // Attempt 1: High accuracy GPS
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        // If user explicitly denied permission, fail immediately
        if (error.code === 1) {
          reject(new GeolocationPermissionError(ERROR_MESSAGES[1]));
          return;
        }

        // Attempt 2: Fallback to Network / Wi-Fi positioning (fast and reliable on laptops & indoors)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          },
          (fallbackError) => {
            const message =
              ERROR_MESSAGES[fallbackError.code] ??
              ERROR_MESSAGES[error.code] ??
              'Location unavailable. Please make sure location access is enabled.';
            reject(new Error(message));
          },
          {
            enableHighAccuracy: false,
            timeout: 8_000,
            maximumAge: 60_000,
          },
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 5_000,
        maximumAge: 30_000,
      },
    );
  });
}

/**
 * Build a verified, coordinate-sanitized Google Maps link from latitude and longitude.
 * Validates finite numerical bounds (lat: [-90, 90], lng: [-180, 180]) to prevent
 * query parameter injection, NaN errors, or URL distortion.
 */
export function getGoogleMapsLink(lat: number, lng: number): string {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    throw new Error('Invalid coordinate numbers / अमान्य निर्देशांक संख्याएं');
  }

  const safeLat = Math.max(-90, Math.min(90, lat));
  const safeLng = Math.max(-180, Math.min(180, lng));

  return `https://www.google.com/maps?q=${safeLat.toFixed(6)},${safeLng.toFixed(6)}`;
}

/**
 * Convenience function: get the user's current location and return a
 * Google Maps link pointing to it.
 *
 * Throws with a user-friendly error message if location cannot be obtained.
 */
export async function getLocationLink(): Promise<string> {
  const coords = await getCurrentPosition();
  return getGoogleMapsLink(coords.lat, coords.lng);
}
