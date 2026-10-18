// ---------------------------------------------------------------------------
// App-wide constants
// ---------------------------------------------------------------------------

/** Display name of the application. */
export const APP_NAME = 'Suraksha' as const;

/** Default English tagline. */
export const APP_TAGLINE = 'Your Personal Safety Tool' as const;

// ---------------------------------------------------------------------------
// Status colours (Tailwind-compatible hex values)
// ---------------------------------------------------------------------------

export const STATUS_COLORS = {
  /** User is safe / recently checked in */
  safe: '#22C55E',
  /** No update for a while — might want to check */
  warning: '#F59E0B',
  /** User has flagged they need help or no response for too long */
  danger: '#EF4444',
  /** Unknown or inactive state */
  inactive: '#71717A',
} as const;

// ---------------------------------------------------------------------------
// Navigation links
// ---------------------------------------------------------------------------

export const NAV_LINKS = [
  { href: '/', icon: 'home', labelEn: 'Home', labelHi: 'होम' },
  { href: '/qr-card', icon: 'qr', labelEn: 'QR Card', labelHi: 'QR कार्ड' },
  { href: '/check-in', icon: 'checkin', labelEn: 'Check-In', labelHi: 'चेक-इन' },
  { href: '/sos', icon: 'sos', labelEn: 'SOS', labelHi: 'SOS' },
] as const;

export type StatusColorKey = keyof typeof STATUS_COLORS;

// ---------------------------------------------------------------------------
// Status thresholds (in minutes)
// ---------------------------------------------------------------------------

/**
 * How long (in minutes) since the last check-in before the status changes.
 *
 * - `safe_minutes`: Under this → green / safe
 * - `warning_minutes`: Between safe and this → amber / warning
 * - Beyond `warning_minutes` → red / danger
 */
export const STATUS_THRESHOLDS = {
  safe_minutes: 60,
  warning_minutes: 120,
  /** Warning threshold in hours (for public status page) */
  warning: 1,
  /** Danger threshold in hours (for public status page) */
  danger: 2,
} as const;

// ---------------------------------------------------------------------------
// Feature defaults
// ---------------------------------------------------------------------------

/** How many hours a check-in page stays active before auto-expiry. */
export const DEFAULT_EXPIRY_HOURS = 24 as const;

/** Maximum number of SOS emergency contacts a user can save. */
export const MAX_CONTACTS = 5 as const;

/** Length of the numeric passcode used for check-in pages. */
export const PASSCODE_LENGTH = 4 as const;
