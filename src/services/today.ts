import { apiUrl } from '../utils/apiUrl';
import type { AutomationState } from './specPaper';
export type ItemKind = 'VALIDATED' | 'AGGRESSIVE_OPEN' | 'OVERNIGHT' | 'WATCHING' | 'NEAR_TRIGGER' | 'WAITING' | 'BLOCKED' | 'SKIPPED' | 'DISCOVER';
export interface SmartFlag { kind: 'PROMOTER_BUYING' | 'PROMOTER_SELLING' | 'INVESTOR_BUYING' | 'INVESTOR_SELLING' | 'PLEDGED'; text: string }
export interface SmartRow { symbol: string; company: string; promoterNetPct: number; promoterBuys: number; promoterSells: number; outsiderNetPct: number; outsiders: string[]; otherFilings: number; lastAt: string | null; lastSource?: string | null; pledgedPct: number | null; pledgePeriod?: string | null }
export interface SmartMoney { at: string; since: string; failures: { source: string; reason: string }[]; promoterBuying: SmartRow[]; promoterSelling: SmartRow[]; investorBuying: SmartRow[]; pledged: SmartRow[] }
export interface TodayItem { smartMoney?: SmartFlag[]; kind: ItemKind; symbol: string; side: 'BUY' | 'SELL'; segment?: string; ruleId?: string; setup?: string; title: string; why?: string; status: string; price?: number | null; pnl?: number | null; pnlPct?: number | null; stop?: number; target?: number; distancePct?: number; score?: number | null; until?: string; firstSeenAt?: string; firstPrice?: number }
export interface BookPosition { exitOn?: string; contract?: string; id: string; setup: string; symbol: string; side: 'BUY' | 'SELL'; product: string; qty: number; entryPrice: number; entryAt: string; stop: number; target: number | null; mark: number | null; why: string; exitBy: string | null; openPnl: number | null; openPct: number | null }
export interface ClosedTrade extends BookPosition { exitPrice: number; exitAt: string; exitReason: string; gross: number; charges: number; net: number; netPct: number }
export interface SetupStats { id: string; label: string; trades: number; wins: number; net: number; winRate: number | null; profitFactor: number | null }
export interface BookSummary {
 policy: { id: string; capitalPerTrade: number; maxOpen: number; dailyLossStop: number; overnight: { maxPositions: number; maxNotional: number; disasterStopPct: number }; intraday: { minScore: number; stopPct: number; targetPct: number }; swing: { stopPct: number; targetPct: number; maxSessions: number } };
 setups: Record<string, { label: string; product: string; rule: string }>;
 today: { realized: number; trades: number; wins: number; stopped: boolean; openPnl: number; pnl: number };
 open: BookPosition[]; closedToday: ClosedTrade[]; recentClosed: ClosedTrade[]; bySetup: SetupStats[]; allTimeNet: number; startedAt: string;
 lastCycle: { at: string; marketOpen: boolean; scanObserved?: boolean } | null;
 overnight: Overnight | null;
}
export interface OvernightRow { symbol: string; price: number; retPct: number; volumeRatio: number | null; closeLocation: number | null; newHigh: boolean; qualifies: boolean; rule: string | null; needs: string[] }
export interface Overnight { date: string; at: string; niftyUp: boolean | null; entryWindow: string; rows: OvernightRow[]; qualifying: number; scanned: number }
export interface TodayResponse {
 computedAt: string; items: TodayItem[]; book: BookSummary | null; unavailable: string[]; automation: AutomationState | null;
 coverage: { id: string; label: string; rules: number; validated: number; stocks: number }[];
 held: { symbol: string; strategyName: string; changePct?: number }[];
 smartMoney: SmartMoney | null;
 deals: { date: string | null; roundTrips: number; rows: { kind: string; symbol: string; client: string; side: 'BUY' | 'SELL'; quantity: number; price: number | null; value: number; gross: number }[] };
}
export async function fetchToday(): Promise<TodayResponse> {
 const r = await fetch(apiUrl('/api/today'), { signal: AbortSignal.timeout(30000) });
 const b = await r.json().catch(() => ({ error: 'Today service returned a page instead of JSON' }));
 if (!r.ok) throw new Error(b.error ?? 'Today unavailable');
 return b as TodayResponse;
}
