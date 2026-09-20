// Supabase client for public IPO cache reads and the optional authenticated push service.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ponytail: these are public (anon) keys — safe to expose in frontend
// RLS (Row Level Security) protects data server-side
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

export function isSupabaseConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

// Shared anonymous-key cloud sync was removed. Trading journals remain device-local.
// A future journal API must authenticate ownership and use account-scoped database rows.
