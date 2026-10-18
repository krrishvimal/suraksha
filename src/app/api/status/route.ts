import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import type { StatusPageRow } from '@/lib/supabase';

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

    const { passcode, location_link } = body as { passcode?: string; location_link?: string };

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

    const supabase = getSupabaseAdmin();

    // Rate limiting: check recent creations from same origin
    const clientId = getClientIdentifier(request);
    if (clientId !== 'unknown') {
      const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

      const { count, error: countError } = await supabase
        .from('status_pages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', windowStart);

      if (!countError && count !== null && count >= MAX_CREATIONS_PER_WINDOW) {
        return NextResponse.json(
          { error: 'Too many status pages created. Please try again later. / बहुत अधिक पेज बनाए गए। कृपया बाद में पुनः प्रयास करें।' },
          { status: 429 }
        );
      }
    }

    // Hash the passcode
    const salt = await bcrypt.genSalt(10);
    const passcodeHash = await bcrypt.hash(passcode, salt);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('status_pages')
      .insert({
        passcode_hash: passcodeHash,
        status: 'active',
        message: null,
        location_link: location_link || null,
        last_checkin_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select('id, status, created_at, expires_at')
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
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Status creation error:', err);
    return NextResponse.json(
      { error: 'Internal server error / आंतरिक सर्वर त्रुटि' },
      { status: 500 }
    );
  }
}
