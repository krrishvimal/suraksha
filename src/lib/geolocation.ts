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

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        const message =
          ERROR_MESSAGES[error.code] ??
          `An unknown location error occurred (code ${error.code}).`;
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 0, // Always get a fresh position
      },
    );
  });
}

/**
 * Build a Google Maps link from latitude and longitude.
 */
export function getGoogleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
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
