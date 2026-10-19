import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { encodeMessagePayload, type StatusPageRow } from '@/lib/supabase';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_CREATIONS_PER_WINDOW = 5;
const DEFAULT_EXPIRY_HOURS = 24;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

// ─── Ephemeral In-Memory Client Rate Limiting Store ─────────────────────────
// Tracks creation counts per client origin/IP in a 1-hour sliding window.
// This preserves zero-PII privacy (IPs are never written to PostgreSQL) while
// fixing the bug where 5 global creations blocked all subsequent users worldwide.
interface IpCreationRecord {
  timestamps: number[];
}

const creationRateLimitMap = new Map<string, IpCreationRecord>();

function isCreationRateLimited(clientId: string): boolean {
  if (clientId === 'unknown') return false;

  const now = Date.now();
  const record = creationRateLimitMap.get(clientId) || { timestamps: [] };

  // Filter timestamps within the rolling window
  const activeTimestamps = record.timestamps.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  if (activeTimestamps.length >= MAX_CREATIONS_PER_WINDOW) {
    return true;
  }

  activeTimestamps.push(now);
  creationRateLimitMap.set(clientId, { timestamps: activeTimestamps });

  // Self-cleaning: prevent memory leaks if map grows large (> 1,000 entries)
  if (creationRateLimitMap.size > 1000) {
    for (const [key, val] of creationRateLimitMap.entries()) {
      const valid = val.timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
      if (valid.length === 0) {
        creationRateLimitMap.delete(key);
      } else {
        creationRateLimitMap.set(key, { timestamps: valid });
      }
    }
  }

  return false;
}

function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfIp = request.headers.get('cf-connecting-ip');
  return cfIp || (forwarded ? forwarded.split(',')[0].trim() : '') || realIp || 'unknown';
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body / अमान्य अनुरोध' },
        { status: 400 }
      );
    }

    const { passcode, location_link, interval_minutes } = body as {
      passcode?: string;
      location_link?: string;
      interval_minutes?: number;
    };

    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json(
        { error: 'Passcode is required / पासकोड आवश्यक है' },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(passcode)) {
      return NextResponse.json(
        { error: 'Passcode must be exactly 4 digits / पासकोड 4 अंकों का होना चाहिए' },
        { status: 400 }
      );
    }

    // Rate limiting: check recent creations from this specific client origin/IP
    const clientId = getClientIdentifier(request);
    if (isCreationRateLimited(clientId)) {
      return NextResponse.json(
        { error: 'Too many status pages created. Please try again later. / बहुत अधिक पेज बनाए गए। कृपया बाद में पुनः प्रयास करें।' },
        { status: 429 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Hash the passcode
    const salt = await bcrypt.genSalt(10);
    const passcodeHash = await bcrypt.hash(passcode, salt);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000);

    const nowIso = now.toISOString();

    const initialInterval =
      typeof interval_minutes === 'number' && [10, 15, 30, 60].includes(interval_minutes)
        ? interval_minutes
        : 10;
    const initialMessage = encodeMessagePayload(null, initialInterval);

    const { data, error } = await supabase
      .from('status_pages')
      .insert({
        passcode_hash: passcodeHash,
        status: 'active',
        message: initialMessage,
        location_link: location_link || null,
        last_checkin_at: nowIso,
        expires_at: expiresAt.toISOString(),
      })
      .select('id, status, created_at, expires_at, last_checkin_at, location_link')
      .single();

    if (error || !data) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create status page / स्थिति पेज बनाने में विफल' },
        { status: 500 }
      );
    }

    const row = data as Partial<StatusPageRow>;

    return NextResponse.json(
      {
        id: row.id,
        status: row.status,
        created_at: row.created_at,
        expires_at: row.expires_at,
        last_checkin_at: row.last_checkin_at || nowIso,
        location_link: row.location_link || location_link || null,
        message: null,
        interval_minutes: initialInterval,
        server_time: new Date().toISOString(),
      },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err) {
    console.error('Status creation error:', err);
    return NextResponse.json(
      { error: 'Internal server error / आंतरिक सर्वर त्रुटि' },
      { status: 500 }
    );
  }
}
