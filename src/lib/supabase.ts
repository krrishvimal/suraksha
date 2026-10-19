import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Database type definitions
// ---------------------------------------------------------------------------

/** Possible statuses for a check-in status page. */
export type CheckinStatus = 'active' | 'safe' | 'need_help';

/** Row shape for the `status_pages` table. */
export interface StatusPageRow {
  id: string;
  passcode_hash: string;
  status: CheckinStatus;
  message: string | null;
  location_link: string | null;
  last_checkin_at: string;
  created_at: string;
  expires_at: string;
}

export interface DecodedStatusMessage {
  message: string | null;
  interval_minutes: number;
}

/**
 * Encodes optional user message and active safety timer interval into the database text column.
 */
export function encodeMessagePayload(
  userMessage?: string | null,
  intervalMinutes?: number | null
): string {
  const cleanInterval =
    typeof intervalMinutes === 'number' && [10, 15, 30, 60].includes(intervalMinutes)
      ? intervalMinutes
      : 10;
  const cleanText = userMessage && typeof userMessage === 'string' ? userMessage.trim() : null;

  return JSON.stringify({
    text: cleanText,
    interval: cleanInterval,
  });
}

/**
 * Decodes user message and active safety timer interval from the database text column.
 * Handles both JSON structured payloads and legacy plain-text messages safely.
 */
export function decodeMessagePayload(rawMessage: string | null | undefined): DecodedStatusMessage {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return { message: null, interval_minutes: 10 };
  }

  try {
    const parsed = JSON.parse(rawMessage);
    if (parsed && typeof parsed === 'object') {
      const interval =
        typeof parsed.interval === 'number' && [10, 15, 30, 60].includes(parsed.interval)
          ? parsed.interval
          : 10;
      const text = typeof parsed.text === 'string' ? parsed.text : null;
      return { message: text, interval_minutes: interval };
    }
  } catch {
    // Legacy plain text message
  }

  return { message: rawMessage, interval_minutes: 10 };
}

export interface StatusPageInsert {
  id?: string;
  passcode_hash: string;
  status?: CheckinStatus;
  message?: string | null;
  location_link?: string | null;
  last_checkin_at?: string;
  created_at?: string;
  expires_at?: string;
}

export interface StatusPageUpdate {
  id?: string;
  passcode_hash?: string;
  status?: CheckinStatus;
  message?: string | null;
  location_link?: string | null;
  last_checkin_at?: string;
  created_at?: string;
  expires_at?: string;
}

/** Supabase Database type — maps public schema tables to their row types. */
export interface Database {
  public: {
    Tables: {
      status_pages: {
        Row: StatusPageRow;
        Insert: StatusPageInsert;
        Update: StatusPageUpdate;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

let clientInstance: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!clientInstance) {
    clientInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return clientInstance;
}

/**
 * Singleton Supabase client for browser-side usage.
 */
export const supabase = getSupabase();
