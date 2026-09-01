// ponytail: live IPO data from InvestorGain API via proxy. Same source as ipo-tracker Python backend.
import { apiUrl } from '../utils/apiUrl';

export interface IPOData {
  name: string;
  price: number | null;
  lot_size: number | null;
  issue_size_cr: number | null;
  open_date: string | null;
  close_date: string | null;
  listing_date: string | null;
  status: 'open' | 'upcoming' | 'listed' | 'closed' | 'unknown';
  board: 'mainboard' | 'sme';
  gmp: number | null;
  gmp_pct: number | null;
  subscription_total: number | null;
  subscription_qib: number | null;
  subscription_nii: number | null;
  subscription_rii: number | null;
  subscription_shni: number | null;
  subscription_bhni: number | null;
  subscription_updated: string | null;
  listing_gain_pct: number | null;
  rating: number | null;
  pe_ratio: number | null;
  score: number;
  recommendation: 'Strong Apply' | 'Apply' | 'Neutral' | 'Avoid';
  reasons: string[];
  allotment_tips: string[];
  url: string | null;
  id: string | null;
}

function financialYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

function stripHtml(html: string): string {
  return html?.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim() || '';
}

function toFloat(val: any): number | null {
  if (val == null) return null;
  const s = String(val).replace(/[₹,\s]/g, '').replace(/<[^>]*>/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseStatus(nameHtml: string): 'open' | 'upcoming' | 'listed' | 'closed' | 'unknown' {
  if (/L@[\d.]+/i.test(nameHtml)) return 'listed';
  const badges = nameHtml.match(/class="badge[^"]*"[^>]*>([^<]+)/g) || [];
  const statusBadge = badges.length > 1 ? badges[1].replace(/.*>/, '').trim() : '';
  if (statusBadge === 'O') return 'open';
  if (statusBadge === 'U') return 'upcoming';
  if (statusBadge === 'C') return 'closed';
  return 'unknown';
}

function parseBoard(nameHtml: string, category?: string): 'mainboard' | 'sme' {
  if (category === 'SME') return 'sme';
  return /sme/i.test(nameHtml) ? 'sme' : 'mainboard';
}

function parseRating(ratingHtml: string): number | null {
  const count = (ratingHtml || '').split('🔥').length - 1 || (ratingHtml || '').split('⭐').length - 1;
  return count || null;
}

function parseListingGain(nameHtml: string): number | null {
  const m = nameHtml.match(/L@[\d.]+\s*\(([-+]?[\d.]+)%?\)/i);
  return m ? parseFloat(m[1]) : null;
}

// Score an IPO based on available data (simplified version of ipo-tracker scoring.py)
function scoreIPO(ipo: Partial<IPOData>): { score: number; recommendation: string; reasons: string[] } {
  let score = 50; // base
  const reasons: string[] = [];

  // GMP scoring (weight: 25%)
  if (ipo.gmp_pct != null) {
    if (ipo.gmp_pct > 50) { score += 20; reasons.push(`Very high GMP at ${ipo.gmp_pct.toFixed(1)}% — strong grey market demand`); }
    else if (ipo.gmp_pct > 25) { score += 12; reasons.push(`Good GMP at ${ipo.gmp_pct.toFixed(1)}% — positive market sentiment`); }
    else if (ipo.gmp_pct > 10) { score += 5; reasons.push(`Moderate GMP at ${ipo.gmp_pct.toFixed(1)}%`); }
    else if (ipo.gmp_pct > 0) { score += 0; reasons.push(`Low GMP at ${ipo.gmp_pct.toFixed(1)}% — lukewarm demand`); }
    else { score -= 10; reasons.push(`Negative/zero GMP — market not enthusiastic`); }
  }

  // Subscription scoring (weight: 20%)
  if (ipo.subscription_total != null) {
    if (ipo.subscription_total > 50) { score += 15; reasons.push(`Massive subscription ${ipo.subscription_total.toFixed(1)}x — very high demand`); }
    else if (ipo.subscription_total > 10) { score += 10; reasons.push(`Strong subscription ${ipo.subscription_total.toFixed(1)}x`); }
    else if (ipo.subscription_total > 3) { score += 5; reasons.push(`Moderate subscription ${ipo.subscription_total.toFixed(1)}x`); }
    else if (ipo.subscription_total > 1) { score += 0; reasons.push(`Low subscription ${ipo.subscription_total.toFixed(1)}x — may list flat`); }
    else { score -= 5; reasons.push(`Under-subscribed — risky`); }
  }

  // Rating scoring (weight: 10%)
  if (ipo.rating != null) {
    if (ipo.rating >= 4) { score += 8; reasons.push(`High analyst rating (${ipo.rating}/5)`); }
    else if (ipo.rating >= 3) { score += 4; reasons.push(`Moderate analyst rating (${ipo.rating}/5)`); }
    else { score -= 3; reasons.push(`Low analyst rating (${ipo.rating}/5)`); }
  }

  // PE ratio
  if (ipo.pe_ratio != null) {
    if (ipo.pe_ratio < 20) { score += 5; reasons.push(`Attractive P/E of ${ipo.pe_ratio.toFixed(1)}x`); }
    else if (ipo.pe_ratio > 50) { score -= 5; reasons.push(`Expensive at P/E ${ipo.pe_ratio.toFixed(1)}x`); }
  }

  // Board bonus
  if (ipo.board === 'sme' && ipo.gmp_pct != null && ipo.gmp_pct > 30) {
    score += 5; reasons.push('SME with strong GMP — small supply amplifies gains');
  }

  // Listing gain (if already listed)
  if (ipo.listing_gain_pct != null) {
    reasons.push(`Listed at ${ipo.listing_gain_pct > 0 ? '+' : ''}${ipo.listing_gain_pct.toFixed(1)}% gain`);
  }

  score = Math.max(0, Math.min(100, score));

  let recommendation: string;
  if (score >= 72) recommendation = 'Strong Apply';
  else if (score >= 55) recommendation = 'Apply';
  else if (score >= 35) recommendation = 'Neutral';
  else recommendation = 'Avoid';

  return { score, recommendation, reasons };
}

const ALLOTMENT_TIPS: Record<string, string[]> = {
  mainboard: [
    'Apply at cut-off price — never miss allotment due to price band revision',
    'Apply in multiple demat accounts (family members) for higher lottery chance',
    'UPI mandate must be approved within 12hrs of application',
    'Single lot application maximizes allotment probability for retail category',
  ],
  sme: [
    'Apply in exactly 1 lot — same allotment chance as multiple lots (lottery)',
    'Multiple demat accounts increase chances linearly',
    'Check if T2T (trade-to-trade) segment — impacts selling post-listing',
    'SME IPOs have higher listing gains but also higher risk — apply only in strong GMP',
  ],
};

interface SubData {
  total: number | null;
  qib: number | null;
  nii: number | null;
  rii: number | null;
  shni: number | null;
  bhni: number | null;
  updated: string | null;
}

// Fetch live subscription data from InvestorGain report 333
async function fetchSubscriptionData(): Promise<Map<string, SubData>> {
  const map = new Map<string, SubData>();
  try {
    const now = new Date();
    const fy = financialYear();
    const url = `/api/ipo/cloud/v2/report/data-read/333/1/1/${now.getFullYear()}/${fy}/0/all`;
    const res = await fetch(apiUrl(url));
    if (!res.ok) return map;
    const payload = await res.json();
    const rows = payload?.reportTableData || [];
    for (const row of rows) {
      const id = String(row['~id'] || '');
      if (!id) continue;
      const totalHtml = String(row['Total'] || '');
      const totalMatch = stripHtml(totalHtml).match(/([\d.]+)/);
      const updatedMatch = totalHtml.match(/(\d+\w+ \w+ [\d:]+)/);
      map.set(id, {
        total: totalMatch ? parseFloat(totalMatch[1]) : null,
        qib: toFloat(row['QIB']),
        nii: toFloat(row['NII']),
        rii: toFloat(row['RII']),
        shni: toFloat(row['SHNI']),
        bhni: toFloat(row['BHNI']),
        updated: updatedMatch ? updatedMatch[1] : null,
      });
    }
  } catch (e) {
    console.warn('[IPO] Subscription fetch failed:', e);
  }
  return map;
}

function parseIPORows(rows: any[], subMap: Map<string, SubData>): IPOData[] {
  return rows.map(row => {
    const nameHtml = String(row['Name'] || '');
    const name = String(row['~ipo_name'] || stripHtml(nameHtml));
    const category = String(row['~IPO_Category'] || '');
    const id = String(row['~id'] || '');
    const status = parseStatus(nameHtml);
    const board = parseBoard(nameHtml, category);
    const price = toFloat(row['Price (₹)']);
    const gmpHtml = String(row['GMP'] || '');
    const gmpMatch = stripHtml(gmpHtml).match(/([-\d,.]+)/);
    const gmpValue = gmpMatch ? toFloat(gmpMatch[1]) : null;
    const gmpPct = toFloat(row['~gmp_percent_calc']);
    const subStr = String(row['Sub'] || '-');
    const sub = subStr === '-' ? null : toFloat(subStr);
    const lot = toFloat(row['Lot']);
    const issueSize = toFloat(stripHtml(String(row['IPO Size'] || '')));
    const pe = toFloat(row['~P/E']);
    const rating = parseRating(String(row['Rating'] || ''));
    const listingGain = parseListingGain(nameHtml);
    const openDate = row['~Srt_Open'] || null;
    const closeDate = row['~Srt_Close'] || null;
    const listingDate = row['~Str_Listing'] || null;
    const urlPath = row['~urlrewrite_folder_name'];

    const subData = subMap.get(id);
    const subTotal = subData?.total ?? sub;

    const partial: Partial<IPOData> = {
      name, price, lot_size: lot ? Math.round(lot) : null,
      issue_size_cr: issueSize, open_date: openDate, close_date: closeDate,
      listing_date: listingDate, status, board, id,
      gmp: gmpValue, gmp_pct: gmpPct,
      subscription_total: subTotal,
      subscription_qib: subData?.qib ?? null, subscription_nii: subData?.nii ?? null,
      subscription_rii: subData?.rii ?? null, subscription_shni: subData?.shni ?? null,
      subscription_bhni: subData?.bhni ?? null, subscription_updated: subData?.updated ?? null,
      listing_gain_pct: listingGain, rating, pe_ratio: pe,
      url: urlPath ? `https://www.investorgain.com${urlPath}` : null,
    };

    const { score, recommendation, reasons } = scoreIPO(partial);
    return { ...partial, score, recommendation: recommendation as any, reasons,
      allotment_tips: ALLOTMENT_TIPS[board] || ALLOTMENT_TIPS.mainboard } as IPOData;
  }).filter(ipo => ipo.name && ipo.name.length > 2);
}

let lastFetchError: string | null = null;
export function getLastIPOFetchError(): string | null {
  return lastFetchError;
}

export async function fetchLiveIPOs(): Promise<IPOData[]> {
  lastFetchError = null;
  const now = new Date();
  const fy = financialYear();
  const url = `/api/ipo/cloud/v2/report/data-read/331/1/1/${now.getFullYear()}/${fy}/0/all`;

  try {
    // Fetch IPO list and subscription data in parallel
    const [res, subMap] = await Promise.all([
      fetch(apiUrl(url)),
      fetchSubscriptionData(),
    ]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawText = await res.text();
    let payload: any;
    try {
      payload = JSON.parse(rawText);
    } catch {
      // Not JSON — likely a bot-block/captcha page from InvestorGain
      throw new Error(`Non-JSON response (likely blocked): "${rawText.slice(0, 120).replace(/\s+/g, ' ')}"`);
    }
    console.log('[IPO] API response keys:', Object.keys(payload), 'rows:', payload?.reportTableData?.length, 'subs:', subMap.size);

    const rows: any[] = payload?.reportTableData || [];
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('No data in reportTableData');

    const result = parseIPORows(rows, subMap);

    console.log('[IPO] Parsed', result.length, 'IPOs');
    return result;
  } catch (e: any) {
    const directError = e?.message || String(e);
    console.warn('IPO direct fetch failed, trying Supabase cache:', e);

    // Fallback: read from Supabase (populated by Vercel cron job)
    try {
      const { getSupabase } = await import('./supabaseClient');
      const sb = getSupabase();
      if (sb) {
        const { data } = await sb.from('app_data').select('data').eq('id', 'ipo_live_data').single();
        if (data?.data) {
          const cached = JSON.parse(data.data);
          const rows = cached.ipoRows || [];
          const subRows = cached.subRows || [];
          if (rows.length > 0) {
            console.log(`[IPO] Using Supabase cache (${rows.length} IPOs, fetched: ${cached.fetchedAt})`);
            // Build sub map from cached sub rows
            const subMap = new Map<string, SubData>();
            for (const row of subRows) {
              const id = String(row['~id'] || '');
              if (!id) continue;
              const totalHtml = String(row['Total'] || '');
              const totalMatch = stripHtml(totalHtml).match(/([\d.]+)/);
              const updatedMatch = totalHtml.match(/(\d+\w+ \w+ [\d:]+)/);
              subMap.set(id, {
                total: totalMatch ? parseFloat(totalMatch[1]) : null,
                qib: toFloat(row['QIB']), nii: toFloat(row['NII']),
                rii: toFloat(row['RII']), shni: toFloat(row['SHNI']), bhni: toFloat(row['BHNI']),
                updated: updatedMatch ? updatedMatch[1] : null,
              });
            }
            // Re-parse using same logic (rows are raw InvestorGain format)
            lastFetchError = `Live fetch failed (${directError}) — showing cached data from ${cached.fetchedAt}`;
            return parseIPORows(rows, subMap);
          }
          lastFetchError = `Live fetch failed (${directError}); cache exists but is empty`;
        } else {
          lastFetchError = `Live fetch failed (${directError}); no cache yet — visit /api/cron-ipo once to populate`;
        }
      } else {
        lastFetchError = `Live fetch failed (${directError}); Supabase not configured for fallback`;
      }
    } catch (sbErr: any) {
      lastFetchError = `Live fetch failed (${directError}); Supabase fallback error: ${sbErr?.message || sbErr}`;
      console.warn('[IPO] Supabase fallback also failed:', sbErr);
    }

    return [];
  }
}
