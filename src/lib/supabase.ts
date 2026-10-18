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
