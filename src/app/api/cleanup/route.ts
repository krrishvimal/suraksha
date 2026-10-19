import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * GET /api/cleanup
 *
 * Deletes expired status_pages rows (where expires_at < now).
 * Called automatically by Vercel Cron every hour.
 *
 * Safety: Only deletes rows whose expiry is already in the past.
 * Active / non-expired sessions are NEVER touched.
 */

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

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, CRON_SECRET is strictly required
    if (process.env.NODE_ENV === 'production' && !cronSecret) {
      console.error('[Cleanup] CRON_SECRET must be configured in production environment');
      return NextResponse.json(
        { error: 'Server misconfiguration: CRON_SECRET is required' },
        { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    if (cronSecret) {
      const expected = `Bearer ${cronSecret}`;
      const headerVal = authHeader || '';
      const headerBuf = Buffer.from(headerVal);
      const expectedBuf = Buffer.from(expected);

      // Constant-time comparison prevents side-channel timing leaks
      if (
        headerBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(headerBuf, expectedBuf)
      ) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
      }
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('status_pages')
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (error) {
      console.error('Cleanup error:', error);
      return NextResponse.json(
        { error: 'Cleanup failed', details: error.message },
        { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const deletedCount = data?.length ?? 0;
    console.log(`[Cleanup] Deleted ${deletedCount} expired status page(s) at ${now}`);

    return NextResponse.json(
      {
        ok: true,
        deleted: deletedCount,
        timestamp: now,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
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
    console.error('Cleanup route error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
