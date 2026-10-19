-- ============================================================================
-- Suraksha (सुरक्षा) Database Schema, Performance Indexes & RLS Lockdown
-- ============================================================================
-- Target Database: Supabase PostgreSQL
-- Table: status_pages
-- Description: Ephemeral, zero-knowledge safety check-in status sessions
-- ============================================================================

-- 1. Table DDL (if creating table from scratch)
CREATE TABLE IF NOT EXISTS public.status_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passcode_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'safe', 'need_help')),
    message TEXT,
    location_link TEXT,
    last_checkin_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + INTERVAL '24 hours')
);

-- ============================================================================
-- 2. Performance & High-Scale Indexes
-- ============================================================================

-- Index on expires_at:
-- Crucial for daily Vercel Cron cleanup (DELETE WHERE expires_at < now()).
-- Transforms sequential table scans into fast B-Tree index range scans.
CREATE INDEX IF NOT EXISTS idx_status_pages_expires_at 
ON public.status_pages (expires_at);

-- Index on created_at:
-- Speeds up chronological ordering and session creation analytics.
CREATE INDEX IF NOT EXISTS idx_status_pages_created_at 
ON public.status_pages (created_at DESC);

-- Composite Index for fast active session lookups:
CREATE INDEX IF NOT EXISTS idx_status_pages_active_sessions 
ON public.status_pages (id, expires_at);

-- ============================================================================
-- 3. Complete Zero-Trust Row Level Security (RLS) & Role Lockdown
-- ============================================================================

-- 1. Dynamically drop EVERY existing policy on status_pages regardless of name
DO $$ 
DECLARE 
    pol record;
BEGIN 
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'status_pages') 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.status_pages', pol.policyname); 
    END LOOP; 
END $$;

-- 2. Revoke all direct table privileges from public client roles (anon and authenticated)
REVOKE ALL ON TABLE public.status_pages FROM anon, authenticated;

-- 3. Enable and Force Row Level Security
ALTER TABLE public.status_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_pages FORCE ROW LEVEL SECURITY;

-- Result: Direct browser PostgREST queries via NEXT_PUBLIC_SUPABASE_ANON_KEY are 100% blocked (Permission Denied).
-- All database queries MUST pass through Suraksha's authenticated Next.js API Route Handlers
-- on the server side using the SUPABASE_SERVICE_ROLE_KEY.
