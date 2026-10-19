import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Verify the request is from Vercel Cron (or has the right secret)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is set, require it. Otherwise allow (for local testing).
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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
        { status: 500 }
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
  } catch (err) {
    console.error('Cleanup route error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
