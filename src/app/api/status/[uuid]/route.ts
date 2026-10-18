import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import type { StatusPageRow, CheckinStatus } from '@/lib/supabase';

type RouteParams = { params: Promise<{ uuid: string }> };

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

// ─── GET: Fetch status page by UUID ───────────────────────────────────────────

export async function GET(
  _request: Request,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const { uuid } = await context.params;

    if (!uuid || typeof uuid !== 'string') {
      return NextResponse.json(
        { error: 'Invalid UUID / अमान्य UUID' },
        { status: 400 }
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
        { status: 404 }
      );
    }

    const row = data as StatusPageRow;

    if (isExpired(row.expires_at)) {
      return NextResponse.json(
        { error: 'This status page has expired / यह स्थिति पेज समाप्त हो गया है' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: row.id,
      status: row.status,
      message: row.message,
      location_link: row.location_link,
      last_checkin_at: row.last_checkin_at,
      created_at: row.created_at,
      expires_at: row.expires_at,
      server_time: new Date().toISOString(),
    });
  } catch (err) {
    console.error('GET status error:', err);
    return NextResponse.json(
      { error: 'Internal server error / आंतरिक सर्वर त्रुटि' },
      { status: 500 }
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

    if (!uuid || typeof uuid !== 'string') {
      return NextResponse.json(
        { error: 'Invalid UUID / अमान्य UUID' },
        { status: 400 }
      );
    }

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body / अमान्य अनुरोध' },
        { status: 400 }
      );
    }

    const { passcode, status, message, location_link, update_checkin } = body as {
      passcode?: string;
      status?: string;
      message?: string;
      location_link?: string;
      update_checkin?: boolean;
    };

    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json(
        { error: 'Passcode is required / पासकोड आवश्यक है' },
        { status: 400 }
      );
    }

    if (status && !['safe', 'need_help', 'active'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be "safe", "need_help", or "active" / स्थिति "safe", "need_help", या "active" होनी चाहिए' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch the record with passcode_hash for verification
    const { data: existing, error: fetchError } = await supabase
      .from('status_pages')
      .select('id, passcode_hash, expires_at')
      .eq('id', uuid)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Status page not found / स्थिति पेज नहीं मिला' },
        { status: 404 }
      );
    }

    const existingRow = existing as { id: string; passcode_hash: string; expires_at: string };

    if (isExpired(existingRow.expires_at)) {
      return NextResponse.json(
        { error: 'This status page has expired / यह स्थिति पेज समाप्त हो गया है' },
        { status: 404 }
      );
    }

    // Verify passcode
    const isValid = await bcrypt.compare(passcode, existingRow.passcode_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Incorrect passcode / गलत पासकोड' },
        { status: 401 }
      );
    }

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

    if (message !== undefined) {
      updatePayload.message = message || null;
    }

    if (location_link !== undefined) {
      updatePayload.location_link = location_link || null;
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

    return NextResponse.json({
      id: updatedRow.id,
      status: updatedRow.status,
      message: updatedRow.message,
      location_link: updatedRow.location_link,
      last_checkin_at: updatedRow.last_checkin_at,
      created_at: updatedRow.created_at,
      expires_at: updatedRow.expires_at,
      server_time: new Date().toISOString(),
    });
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

    if (!uuid || typeof uuid !== 'string') {
      return NextResponse.json(
        { error: 'Invalid UUID / अमान्य UUID' },
        { status: 400 }
      );
    }

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body / अमान्य अनुरोध' },
        { status: 400 }
      );
    }

    const { passcode } = body as { passcode?: string };

    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json(
        { error: 'Passcode is required / पासकोड आवश्यक है' },
        { status: 400 }
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
        { status: 404 }
      );
    }

    const existingRow = existing as { id: string; passcode_hash: string };

    // Verify passcode
    const isValid = await bcrypt.compare(passcode, existingRow.passcode_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Incorrect passcode / गलत पासकोड' },
        { status: 401 }
      );
    }

    const { error: deleteError } = await supabase
      .from('status_pages')
      .delete()
      .eq('id', uuid);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete status page / स्थिति पेज हटाने में विफल' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Status page deleted successfully / स्थिति पेज सफलतापूर्वक हटाया गया' },
      { status: 200 }
    );
  } catch (err) {
    console.error('DELETE status error:', err);
    return NextResponse.json(
      { error: 'Internal server error / आंतरिक सर्वर त्रुटि' },
      { status: 500 }
    );
  }
}
