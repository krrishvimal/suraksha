/**
 * Input sanitization, protocol verification, and security validation helpers.
 * Protects against XSS, protocol smuggling, URL spoofing, and malicious payloads.
 */

/**
 * Validates that a location URL is strictly an authenticated HTTPS Google Maps link
 * pointing to valid geographic coordinates.
 *
 * Explicitly rejects:
 * - `javascript:` and `data:` protocol URIs (XSS vector)
 * - Non-HTTPS protocols (`http:`)
 * - Third-party phishing or tracking domains
 */
export function isValidGoogleMapsUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();

  // Enforce maximum URL length to prevent buffer/DOS attacks
  if (trimmed.length > 256) return false;

  // Strict HTTPS requirement
  if (!trimmed.startsWith('https://')) return false;

  try {
    const parsed = new URL(trimmed);

    // Whitelist Google Maps hosts only
    const validHosts = ['maps.google.com', 'www.google.com', 'google.com'];
    if (!validHosts.includes(parsed.hostname.toLowerCase())) {
      return false;
    }

    // Must be a query targeting coordinates
    const q = parsed.searchParams.get('q');
    if (!q) {
      return false;
    }

    // Verify coordinate syntax: lat,lng (e.g. "28.6139,77.2090" or "-33.8688,151.2093")
    const coordRegex = /^-?\d{1,3}(\.\d{1,8})?[, ]-?\d{1,3}(\.\d{1,8})?$/;
    return coordRegex.test(q.trim());
  } catch {
    return false;
  }
}

/**
 * Cleans and sanitizes user-provided custom status messages.
 * Prevents HTML tag smuggling, control-character exploits, and payload bloat.
 */
export function sanitizeUserMessage(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;

  // Strip control characters, null bytes, and script tag markers
  const cleaned = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '') // Strip angle brackets to disarm any HTML/XSS formatting
    .trim();

  if (cleaned.length === 0) return null;

  // Hard cap at 280 characters (standard alert length)
  return cleaned.slice(0, 280);
}

/**
 * Validates strict 4-digit numeric passcode format.
 */
export function isValidPasscode(passcode: string | null | undefined): passcode is string {
  if (!passcode || typeof passcode !== 'string') return false;
  return /^\d{4}$/.test(passcode);
}
