import { apiUrl } from '../utils/apiUrl';
import type { StrategyStatus } from './signals';
export interface GapRow {
 symbol: string; prevClose: number; iep: number; gapPct: number; preOpenQty: number | null; turnover: number | null; buyQty: number | null; sellQty: number | null; imbalance: number | null; yearHigh: number | null; yearLow: number | null; updatedAt: string | null;
 direction: 'UP' | 'DOWN'; open: number | null; ltp: number | null; fromOpenPct: number | null; status: 'PRE_OPEN' | 'HOLDING' | 'EXTENDING' | 'FILLED'; nearYearHigh: number | null; aboveYearHighPreOpen: boolean | null;
 catalyst: { time: string | null; subject: string; text: string; url: string | null }[];
 rules: { strategyId: string; strategyName: string; state: 'IN_POSITION' | 'NEAR_TRIGGER'; trigger: { level: number; distancePct: number } | null; since: number | null }[];
 validated: string[]; composite: number | null;
}
export interface GapsResponse { computedAt: string; preOpenUpdatedAt: string | null; summary: { stocks: number; gapUp: number; gapDown: number; flat: number }; rows: GapRow[]; strategies: StrategyStatus[]; sources: Record<string, string>; limitations: string[] }
export async function fetchOpeningGaps(): Promise<GapsResponse> {
 const r = await fetch(apiUrl('/api/opening-gaps'), { signal: AbortSignal.timeout(45000) });
 const b = await r.json().catch(() => ({ error: 'Opening gaps service returned a page instead of JSON' }));
 if (!r.ok) throw new Error(b.error ?? 'Opening gaps unavailable');
 return b as GapsResponse;
}
