import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────
// Your Supabase connection — shared by every page.
// These values are SAFE to be public: the anon key only grants what your
// Row Level Security rules allow. This is the single place the whole app
// talks to the database.
// ─────────────────────────────────────────────────────────────────────

export const SUPABASE_URL = 'https://jpeanlmbfylihxsvuamm.supabase.co'
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZWFubG1iZnlsaWh4c3Z1YW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzMyNjYsImV4cCI6MjA5MTQwOTI2Nn0.04wuHxGHuScKupZModEFC67snGlc1XKyy1-y0IUX3OM'

// REST headers for direct fetch() calls (kept for parity with the
// existing pages, which talk to the Supabase REST API directly).
export const SB_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + SUPABASE_KEY,
}

// The supabase-js client, for cleaner queries as we migrate pages over.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
