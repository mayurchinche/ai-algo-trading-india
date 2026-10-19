import { apiUrl } from '../utils/apiUrl';
type N = number | null;
export interface Observation { id: string; session_date: string; symbol: string; side: 'BUY' | 'SELL'; first_seen_at: string; first_score: number; first_price: number; first_quote_time: string | null; max_score: number; max_score_at: string; last_seen_at: string; seen_count: number;
 details: { name: string; signal: string; reasons: string[]; strategies: string[]; changePct: N; volumeRatio: N; stop: N; target: N; eligible: boolean; blockedReasons: string[] };
 outcome: { complete: boolean; sessions: number; sessionClose: N; sessionHighPct: N; d1: N; d5: N; d10: N; levels: { result: 'TARGET' | 'STOP' | 'OPEN'; at: string | null; retPct: N } } | null }
export interface AccuracyRow { side: 'BUY' | 'SELL'; band: string; signals: number; withOutcome: number; sessionClose: N; d1: N; d5: N; d10: N; resolved: number; targetFirst: N; winD5: N }
export interface DiscoveryResponse { date: string; recordMinScore: number; watchAlertScore: number; outcomeSessions: number; observations: Observation[]; accuracy: AccuracyRow[]; trackedSignals: number;
 study: { period: string; stocks: number; stockDays: number; baseline10dPct: number; bands: { band: string; n: number; d10: number; nextDayIntradayNet: number; targetFirst: number }[]; finding: string } }
let cache: { at: number; date: string; data: DiscoveryResponse } | null = null;
export async function fetchDiscovery(date?: string): Promise<DiscoveryResponse> {
 if (cache && Date.now() - cache.at < 60000 && cache.date === (date ?? '')) return cache.data;
 const r = await fetch(apiUrl('/api/discovery' + (date ? '?date=' + date : '')), { signal: AbortSignal.timeout(30000) });
 const b = await r.json().catch(() => ({ error: 'Discovery service returned a page instead of JSON' }));
 if (!r.ok) throw Object.assign(new Error(b.error ?? 'Discovery ledger unavailable'), { study: b.study });
 cache = { at: Date.now(), date: date ?? '', data: b }; return b as DiscoveryResponse;
}
