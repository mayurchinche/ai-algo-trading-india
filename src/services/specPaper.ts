import type { StrategySpec } from '../../shared/strategySpec';
import type { SegmentId } from '../../shared/tradingHorizon';
import type { TradeLeg } from '../../shared/specEngine';
import { apiUrl } from '../utils/apiUrl';
export interface PaperOptions { capital: number; costBps?: number; costPerOrder?: number; slippageBps: number; maxUnitsPerOrder: number | null; costModel?: 'flat' | 'broker-tariff'; requireMargin?: boolean }
export interface PaperEvent { time: number; at?: number; kind: string; [k: string]: unknown }
export interface ClosedTrade { tradeId: string | null; time: number; exitTime: number | null; reason: string | null; pnl: number; gross: number | null; charges: number | null; mae: number; mfe: number; margin: number; legs: TradeLeg[] }
export interface TradeStats { trades: number; wins: number; losses: number; winRate: number | null; net: number; gross: number; charges: number; expectancy: number | null; avgWin: number | null; avgLoss: number | null; profitFactor: number | null; maxDrawdown: number; bestTrade: number | null; worstTrade: number | null }
export interface PaperRunSummary {
 id: string; createdAt: string; updatedAt: string; status: 'ACTIVE' | 'STOPPED'; version: number; name: string; segment: SegmentId | null; mode: 'intraday' | 'positional'; underlying: StrategySpec['underlying']; timeframe: string; options: PaperOptions;
 position: 'FLAT' | 'OPEN'; pending: { kind: string; reason?: string } | null; netPnl: number; realized: number; costs: number; orders: number; trades: number; wins: number;
 funds: { capital: number; realized: number; charges: number; ledger: number; blocked: number; available: number; unrealized: number; equity: number } | null;
 stats: TradeStats; openTrade: { tradeId: string; time: number; margin: number; mae: number; mfe: number } | null;
 legs: { id: string; dir: number; units: number; entry: number; entryTime: number | null; mark: number; open: boolean; stop: number | null; target: number | null; exitPrice: number | null; exitTime: number | null; exitReason: string | null; contract: string | null; instrumentKey: string | null }[];
 closedTrades: ClosedTrade[];
 events: PaperEvent[];
 paper: { lastBarTime: number | null; lastCycleAt: string | null; cycles: number; missedBars: number; eventSeq?: number; lastOutcome: string | null };
}
export interface AutomationJob { at: string; status?: string; reason?: string; runs?: number; outcomes?: Record<string, number>; signals?: number; failures?: number; strategy?: string; [k: string]: unknown }
export interface AutomationState { lastTickAt: string; lastJob: string | null; lastDurationMs: number; ticksToday: number; day: string; jobs: Partial<Record<'paper' | 'alerts' | 'aggressive' | 'marketDay' | 'dailyScan' | 'scan' | 'validate' | 'fundamentals' | 'outcomes' | 'smartMoney', AutomationJob>> }
export interface LedgerRow { seq: number; recorded_at: string; kind: string; event: PaperEvent }
async function call<T>(init?: RequestInit, query = ''): Promise<T> {
 const r = await fetch(apiUrl('/api/spec-paper' + query), { ...init, signal: AbortSignal.timeout(30000), headers: init?.body ? { 'Content-Type': 'application/json' } : undefined });
 const b = await r.json().catch(() => ({ error: 'Paper trading service returned a page instead of JSON' }));
 if (!r.ok) throw new Error(b.error + (Array.isArray(b.issues) ? ': ' + b.issues.map((i: { path: string; message: string }) => `${i.path} ${i.message}`).join('; ') : ''));
 return b as T;
}
export const listRuns = () => call<{ runs: PaperRunSummary[]; automation: AutomationState | null }>();
export const createRun = (spec: StrategySpec, options: PaperOptions, id = crypto.randomUUID()) => call<{ run: PaperRunSummary }>({ method: 'POST', body: JSON.stringify({ action: 'create', id, spec, options }) }).then(b => b.run);
export const stopRun = (id: string) => call<{ run: PaperRunSummary }>({ method: 'POST', body: JSON.stringify({ action: 'stop', id }) }).then(b => b.run);
// Pages through the run's complete, permanent ledger.
export async function fetchLedger(id: string): Promise<LedgerRow[]> {
 const rows: LedgerRow[] = []; let after = 0;
 for (let page = 0; page < 200; page++) {
  const b = await call<{ events: LedgerRow[]; next: number | null }>(undefined, `?ledger=${id}&after=${after}&limit=1000`);
  rows.push(...b.events); if (b.next === null) return rows; after = b.next;
 }
 throw new Error('Ledger larger than 200,000 events; export stopped');
}
const cell = (v: unknown) => { const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
// One CSV row per ledger event; nested fields stay as JSON in their column.
export function ledgerCsv(rows: LedgerRow[]): string {
 const keys = [...new Set(rows.flatMap(r => Object.keys(r.event)))].filter(k => !['kind', 'time', 'at'].includes(k));
 return ['seq,recorded_at,kind,time,at,' + keys.join(','), ...rows.map(r => [r.seq, r.recorded_at, r.kind, new Date(r.event.time).toISOString(), r.event.at ? new Date(r.event.at).toISOString() : '', ...keys.map(k => r.event[k])].map(cell).join(','))].join('\n');
}
