-- ============================================================================
-- Suraksha (सुरक्षा) Database Schema & Performance Optimization Indexes
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
-- Crucial for daily / hourly Vercel Cron cleanup (DELETE WHERE expires_at < now()).
-- Transforms sequential table scans into fast B-Tree index range scans.
CREATE INDEX IF NOT EXISTS idx_status_pages_expires_at 
ON public.status_pages (expires_at);

-- Index on created_at:
-- Speeds up session creation analytics and chronological filtering.
CREATE INDEX IF NOT EXISTS idx_status_pages_created_at 
ON public.status_pages (created_at DESC);

-- Composite Index for fast active session lookups:
CREATE INDEX IF NOT EXISTS idx_status_pages_active_sessions 
ON public.status_pages (id, expires_at);

-- ============================================================================
-- 3. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.status_pages ENABLE ROW LEVEL SECURITY;

-- Allow public read access to non-expired status pages (passcode_hash is filtered out at API layer)
CREATE POLICY "Public read for non-expired pages"
ON public.status_pages
FOR SELECT
USING (expires_at > timezone('utc'::text, now()));

-- Service role bypasses RLS for INSERT, UPDATE, DELETE in Next.js Serverless Route Handlers
-- (Supabase default behavior for service_role key)
