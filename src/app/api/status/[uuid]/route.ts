import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import {
  decodeMessagePayload,
  encodeMessagePayload,
  type StatusPageRow,
  type CheckinStatus,
} from '@/lib/supabase';
import {
  isValidGoogleMapsUrl,
  sanitizeUserMessage,
  isValidPasscode,
  isValidUuid,
} from '@/lib/validation';

const PIN_PEPPER = process.env.PIN_PEPPER || 'suraksha-secure-pepper-v1-static-salt';

type RouteParams = { params: Promise<{ uuid: string }> };

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (process.env.NODE_ENV !== 'production' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : '');

  if (!url || !key) {
    throw new Error('Missing Supabase service role environment variables');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

// ─── Brute-Force Rate Limiting Store ──────────────────────────────────────────

interface FailedAttemptRecord {
  count: number;
  lockedUntil: number;
}

const failedAttemptsMap = new Map<string, FailedAttemptRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfIp = request.headers.get('cf-connecting-ip');
  return cfIp || realIp || (forwarded ? forwarded.split(',')[0].trim() : '') || 'unknown';
}

function checkKeyLock(key: string): { isLocked: boolean; remainingMinutes: number } {
  const record = failedAttemptsMap.get(key);
  if (!record) return { isLocked: false, remainingMinutes: 0 };

  const now = Date.now();
  if (record.lockedUntil > now) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    return { isLocked: true, remainingMinutes };
  }

  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    failedAttemptsMap.delete(key);
  }

  return { isLocked: false, remainingMinutes: 0 };
}

function checkBruteForceLock(uuid: string, clientId?: string): { isLocked: boolean; remainingMinutes: number } {
  const uuidLock = checkKeyLock(uuid);
  if (uuidLock.isLocked) return uuidLock;

  if (clientId && clientId !== 'unknown') {
    const ipLock = checkKeyLock(`ip:${clientId}`);
    if (ipLock.isLocked) return ipLock;
  }

  return { isLocked: false, remainingMinutes: 0 };
}

function recordSingleKeyAttempt(key: string): void {
  const now = Date.now();
  const record = failedAttemptsMap.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  failedAttemptsMap.set(key, record);
}

function recordFailedAttempt(uuid: string, clientId?: string): void {
  recordSingleKeyAttempt(uuid);
  if (clientId && clientId !== 'unknown') {
    recordSingleKeyAttempt(`ip:${clientId}`);
  }

  // Periodic pruning if store exceeds 1,000 entries
  if (failedAttemptsMap.size > 1000) {
    const now = Date.now();
    for (const [key, val] of failedAttemptsMap.entries()) {
      if (val.lockedUntil > 0 && val.lockedUntil <= now) {
        failedAttemptsMap.delete(key);
      }
    }
  }
}

function clearFailedAttempts(uuid: string, clientId?: string): void {
  failedAttemptsMap.delete(uuid);
  if (clientId && clientId !== 'unknown') {
    failedAttemptsMap.delete(`ip:${clientId}`);
  }
}

// ─── GET: Fetch status page by UUID ───────────────────────────────────────────

export async function GET(
  _request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { uuid } = await context.params;

    if (!isValidUuid(uuid)) {
      return NextResponse.json(
        { error: 'Invalid UUID format / अमान्य UUID प्रारूप' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('status_pages')
      .select('id, status, message, location_link, last_checkin_at, created_at, expires_at')
      .eq('id', uuid)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Status page not found / स्थिति पेज नहीं मिला' },
        {
          status: 404,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        }
      );
    }

    const row = data as StatusPageRow;

    if (isExpired(row.expires_at)) {
      return NextResponse.json(
        { error: 'This status page has expired / यह स्थिति पेज समाप्त हो गया है' },
        {
          status: 404,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        }
      );
    }

    const { message: decodedMessage, interval_minutes } = decodeMessagePayload(row.message);

    return NextResponse.json(
      {
        id: row.id,
        status: row.status,
        message: decodedMessage,
        interval_minutes,
        location_link: row.location_link,
        last_checkin_at: row.last_checkin_at,
        created_at: row.created_at,
        expires_at: row.expires_at,
        server_time: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=4',
        },
      }
    );
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'digest' in err &&
      (err as { digest?: string }).digest === 'NEXT_PRERENDER_INTERRUPTED'
    ) {
      throw err;
    }
    console.error('GET status error:', err);
    return NextResponse.json(
      { error: 'Internal server error / आंतरिक सर्वर त्रुटि' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  }
}

// ─── PATCH: Update status (check-in) ─────────────────────────────────────────

export async function PATCH(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { uuid } = await context.params;

    if (!isValidUuid(uuid)) {
      return NextResponse.json(
        { error: 'Invalid UUID format / अमान्य UUID प्रारूप' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body / अमान्य अनुरोध' },
        { status: 400 }
      );
    }

    const { passcode, status, message, location_link, update_checkin, interval_minutes } = body as {
      passcode?: string;
      status?: string;
      message?: string;
      location_link?: string;
      update_checkin?: boolean;
      interval_minutes?: number;
    };

    if (!isValidPasscode(passcode)) {
      return NextResponse.json(
        { error: 'Passcode must be exactly 4 digits / पासकोड 4 अंकों का होना चाहिए' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    if (status && !['safe', 'need_help', 'active'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be "safe", "need_help", or "active" / स्थिति "safe", "need_help", या "active" होनी चाहिए' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch the record with passcode_hash and message for verification & payload encoding
    const { data: existing, error: fetchError } = await supabase
      .from('status_pages')
      .select('id, passcode_hash, expires_at, message')
      .eq('id', uuid)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Status page not found / स्थिति पेज नहीं मिला' },
        { status: 404, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const existingRow = existing as {
      id: string;
      passcode_hash: string;
      expires_at: string;
      message: string | null;
    };

    if (isExpired(existingRow.expires_at)) {
      return NextResponse.json(
        { error: 'This status page has expired / यह स्थिति पेज समाप्त हो गया है' },
        { status: 404, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const clientId = getClientIdentifier(request);

    // Brute-force protection: check if UUID or client IP is temporarily locked out
    const lock = checkBruteForceLock(uuid, clientId);
    if (lock.isLocked) {
      return NextResponse.json(
        {
          error: `Too many incorrect passcode attempts. Locked for ${lock.remainingMinutes} minutes. / अत्यधिक गलत प्रयास। ${lock.remainingMinutes} मिनट के लिए लॉक किया गया।`,
        },
        {
          status: 429,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        }
      );
    }

    // Verify passcode with pepper support (backward compatible with unpeppered legacy hashes)
    const isValid =
      (await bcrypt.compare(passcode + PIN_PEPPER, existingRow.passcode_hash)) ||
      (await bcrypt.compare(passcode, existingRow.passcode_hash));

    if (!isValid) {
      recordFailedAttempt(uuid, clientId);
      return NextResponse.json(
        { error: 'Incorrect passcode / गलत पासकोड' },
        {
          status: 401,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        }
      );
    }

    // Success — clear any failed attempts
    clearFailedAttempts(uuid, clientId);

    // Build update payload
    const updatePayload: Record<string, string | null> = {};

    if (status) {
      updatePayload.status = status;
    }

    // Update last_checkin_at if status provided or update_checkin === true
    // If update_checkin is false (background GPS breadcrumb), do not reset check-in timer
    const shouldUpdateCheckin = update_checkin !== false && (status !== undefined || update_checkin === true);
    if (shouldUpdateCheckin) {
      updatePayload.last_checkin_at = new Date().toISOString();
    }

    if (message !== undefined || interval_minutes !== undefined) {
      const currentDecoded = decodeMessagePayload(existingRow.message);
      const nextMessage =
        message !== undefined ? sanitizeUserMessage(message) : currentDecoded.message;
      const nextInterval =
        typeof interval_minutes === 'number' && [10, 15, 30, 60].includes(interval_minutes)
          ? interval_minutes
          : currentDecoded.interval_minutes;

      updatePayload.message = encodeMessagePayload(nextMessage, nextInterval);
    }

    if (location_link !== undefined) {
      if (location_link && !isValidGoogleMapsUrl(location_link)) {
        return NextResponse.json(
          { error: 'Invalid location URL format / अमान्य स्थान लिंक' },
          { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
      }
      updatePayload.location_link = location_link ? location_link.trim() : null;
    }

    const { data: updated, error: updateError } = await supabase
      .from('status_pages')
      .update(updatePayload)
      .eq('id', uuid)
      .select('id, status, message, location_link, last_checkin_at, created_at, expires_at')
      .single();

    if (updateError || !updated) {
      console.error('Supabase update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update status / स्थिति अपडेट करने में विफल' },
        { status: 500 }
      );
    }

    const updatedRow = updated as StatusPageRow;
    const { message: decodedMessage, interval_minutes: returnedInterval } = decodeMessagePayload(
      updatedRow.message
    );

    return NextResponse.json(
      {
        id: updatedRow.id,
        status: updatedRow.status,
        message: decodedMessage,
        interval_minutes: returnedInterval,
        location_link: updatedRow.location_link,
        last_checkin_at: updatedRow.last_checkin_at,
        created_at: updatedRow.created_at,
        expires_at: updatedRow.expires_at,
        server_time: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err) {
    console.error('PATCH status error:', err);
    return NextResponse.json(
      { error: 'Internal server error / आंतरिक सर्वर त्रुटि' },
      { status: 500 }
    );
  }
}

// ─── DELETE: Delete status page ───────────────────────────────────────────────

export async function DELETE(
  request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { uuid } = await context.params;

    if (!isValidUuid(uuid)) {
      return NextResponse.json(
        { error: 'Invalid UUID format / अमान्य UUID प्रारूप' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body / अमान्य अनुरोध' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const { passcode } = body as { passcode?: string };

    if (!isValidPasscode(passcode)) {
      return NextResponse.json(
        { error: 'Passcode must be exactly 4 digits / पासकोड 4 अंकों का होना चाहिए' },
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch the record for passcode verification
    const { data: existing, error: fetchError } = await supabase
      .from('status_pages')
      .select('id, passcode_hash')
      .eq('id', uuid)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Status page not found / स्थिति पेज नहीं मिला' },
        { status: 404, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const existingRow = existing as { id: string; passcode_hash: string };

    const clientId = getClientIdentifier(request);

    // Brute-force protection: check if UUID or client IP is temporarily locked out
    const lock = checkBruteForceLock(uuid, clientId);
    if (lock.isLocked) {
      return NextResponse.json(
        {
          error: `Too many incorrect passcode attempts. Locked for ${lock.remainingMinutes} minutes. / अत्यधिक गलत प्रयास। ${lock.remainingMinutes} मिनट के लिए लॉक किया गया।`,
        },
        {
          status: 429,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        }
      );
    }

    // Verify passcode with pepper support (backward compatible with unpeppered legacy hashes)
    const isValid =
      (await bcrypt.compare(passcode + PIN_PEPPER, existingRow.passcode_hash)) ||
      (await bcrypt.compare(passcode, existingRow.passcode_hash));

    if (!isValid) {
      recordFailedAttempt(uuid, clientId);
      return NextResponse.json(
        { error: 'Incorrect passcode / गलत पासकोड' },
        {
          status: 401,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        }
      );
    }

    // Success — clear any failed attempts
    clearFailedAttempts(uuid, clientId);

    const { error: deleteError } = await supabase
      .from('status_pages')
      .delete()
      .eq('id', uuid);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete status page / स्थिति पेज हटाने में विफल' },
        {
          status: 500,
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        }
      );
    }

    return NextResponse.json(
      { message: 'Status page deleted successfully / स्थिति पेज सफलतापूर्वक हटाया गया' },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (err) {
    console.error('DELETE status error:', err);
    return NextResponse.json(
      { error: 'Internal server error / आंतरिक सर्वर त्रुटि' },
      { status: 500 }
    );
  }
}
