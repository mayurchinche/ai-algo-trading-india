import type { SegmentId } from '../../shared/tradingHorizon';
import { apiUrl } from '../utils/apiUrl';
import type { PaperRunSummary, AutomationState } from './specPaper';
export interface ReturnStats { trades: number; winRate: number | null; expectancyPct: number | null; avgWinPct: number | null; avgLossPct: number | null; profitFactor: number | null; compoundedReturnPct: number; maxDrawdownPct: number }
export interface Signal {
 id: string; strategyId: string; strategyName: string; segment: SegmentId; symbol: string; instrumentKey: string; timeframe: string; barTime: number; decidedAt: number; validUntil: number; close: number; direction: string;
 rule: string; reference: string; maxHoldingDays: number | null; summary: string | null; status: 'ACTIVE' | 'EXPIRED'; recordedAt: string; paperRunId: string;
 legs: { id: string; side: 'BUY' | 'SELL'; instrument: { type: string; optionType?: string; expiry?: string }; levels: { stop: number | null; target: number | null } | null }[];
 validation: { verdict: string; computedAt: string; validatedWith: string | null; onSymbol: { stats: ReturnStats; buyHoldPct: number; period: { from: number; to: number; bars: number }; timeInMarket: number } | { status: string }; pooled: { symbols: number; stats: ReturnStats; halves: { first: ReturnStats; second: ReturnStats } } };
}
export interface StrategyStatus {
 id: string; segment: SegmentId; name: string; timeframe: string; rule: string; reference: string; universe: string; validatedWith: string | null; computedAt: string | null;
 status: 'NOT_VALIDATED_YET' | 'PASSED' | 'FAILED' | 'INSUFFICIENT_EVIDENCE';
 pooled: { symbols: number; stats: ReturnStats; halves: { first: ReturnStats; second: ReturnStats }; passed: boolean; reasons: string[] } | null;
 symbols: { validated: { symbol: string; stats: ReturnStats | null; buyHoldPct: number | null }[]; unproven: number; rejected: number };
}
export interface SignalsResponse { computedAt: string; autoPaper: boolean; automation: AutomationState | null; signals: Signal[]; strategies: StrategyStatus[] }
async function call<T>(init?: RequestInit): Promise<T> {
 const r = await fetch(apiUrl('/api/signals'), { ...init, signal: AbortSignal.timeout(30000), headers: init?.body ? { 'Content-Type': 'application/json' } : undefined });
 const b = await r.json().catch(() => ({ error: 'Signals service returned a page instead of JSON' }));
 if (!r.ok) throw new Error(b.error ?? 'Signals unavailable');
 return b as T;
}
export const fetchSignals = () => call<SignalsResponse>();
export const paperTradeSignal = (signalId: string, capital: number) => call<{ run: PaperRunSummary }>({ method: 'POST', body: JSON.stringify({ action: 'paper', signalId, capital }) }).then(b => b.run);
