// ponytail: Supabase client for cross-device data persistence
// Free tier: 500MB DB, 50K rows, unlimited API requests
// All data still works offline via localStorage — Supabase syncs when available

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

// --- Data sync: localStorage ↔ Supabase ---
// ponytail: localStorage is primary (works offline), Supabase is backup/sync

const DEVICE_ID = getOrCreateDeviceId();

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('device_id', id);
  }
  return id;
}

// Generic sync: push localStorage data to Supabase
export async function syncToCloud(table: string, key: string, data: any): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  try {
    await sb.from(table).upsert({
      id: key,
      device_id: DEVICE_ID,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn(`[Sync] Failed to push ${table}/${key}:`, e);
  }
}

// Generic sync: pull latest from Supabase
export async function syncFromCloud<T>(table: string, key: string): Promise<T | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb.from(table).select('data, updated_at').eq('id', key).single();
    if (error || !data) return null;
    return JSON.parse(data.data) as T;
  } catch (e) {
    console.warn(`[Sync] Failed to pull ${table}/${key}:`, e);
    return null;
  }
}

// Sync paper trades
export async function syncPaperTrades(): Promise<void> {
  const local = localStorage.getItem('paper_trades_v2');
  if (local) await syncToCloud('app_data', 'paper_trades', JSON.parse(local));
}

export async function loadPaperTradesFromCloud(): Promise<any[] | null> {
  return syncFromCloud<any[]>('app_data', 'paper_trades');
}

// Sync IPO applications
export async function syncIPOApplications(): Promise<void> {
  const local = localStorage.getItem('ipo_applications');
  if (local) await syncToCloud('app_data', 'ipo_applications', JSON.parse(local));
}

// Sync settings
export async function syncSettings(): Promise<void> {
  const keys = ['notification_settings', 'auto_apply_settings'];
  for (const key of keys) {
    const local = localStorage.getItem(key);
    if (local) await syncToCloud('app_data', key, JSON.parse(local));
  }
}

// Full sync — call on app load and periodically
export async function fullSync(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    await Promise.all([
      syncPaperTrades(),
      syncIPOApplications(),
      syncSettings(),
    ]);
    console.log('[Sync] Cloud sync complete');
  } catch (e) {
    console.warn('[Sync] Cloud sync failed:', e);
  }
}
