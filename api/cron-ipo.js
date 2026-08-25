// Vercel Cron: fetches IPO data from multiple sources, stores in Supabase
// Runs hourly on Vercel's infrastructure — no local machine needed
// vercel.json cron schedule triggers this endpoint

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/html, */*',
  'Referer': 'https://www.investorgain.com',
  'Origin': 'https://www.investorgain.com',
};

function financialYear() {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  return m >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

async function fetchFromInvestorGain() {
  const now = new Date();
  const fy = financialYear();
  const url = `https://www.investorgain.com/cloud/v2/report/data-read/331/1/1/${now.getFullYear()}/${fy}/0/all`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`InvestorGain HTTP ${res.status}`);
  const data = await res.json();
  return data?.reportTableData || [];
}

async function fetchSubscriptions() {
  const now = new Date();
  const fy = financialYear();
  const url = `https://www.investorgain.com/cloud/v2/report/data-read/333/1/1/${now.getFullYear()}/${fy}/0/all`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.reportTableData || [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  // Verify cron secret (optional security)
  // if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    const [ipoRows, subRows] = await Promise.all([
      fetchFromInvestorGain(),
      fetchSubscriptions(),
    ]);

    // Store in Supabase
    await supabase.from('app_data').upsert({
      id: 'ipo_live_data',
      device_id: 'cron',
      data: JSON.stringify({ ipoRows, subRows, fetchedAt: new Date().toISOString() }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    console.log(`[IPO Cron] Stored ${ipoRows.length} IPOs, ${subRows.length} subs`);
    res.status(200).json({ ok: true, ipos: ipoRows.length, subs: subRows.length });
  } catch (e) {
    console.error('[IPO Cron] Failed:', e.message);
    // Don't overwrite existing data on failure
    res.status(200).json({ ok: false, error: e.message, note: 'Existing cached data preserved' });
  }
}
