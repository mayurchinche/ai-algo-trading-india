import { apiUrl } from '../utils/apiUrl';
import type { GapFill } from './today';
type N = number | null;
export type Verdict = 'TOO_FEW_TRADES' | 'NO_BACKTEST' | 'IN_LINE' | 'BELOW_BACKTEST' | 'ABOVE_BACKTEST';
export interface LiveStats { trades: number; winRatePct: N; avgPct: N; profitFactor: N; standardErrorPct: N; z: N; verdict: Verdict }
export interface RuleAccuracy { id: string; name: string; segment: string; validatedSymbols: number; backtest: { trades: number; winRatePct: N; avgPct: N; profitFactor: N; computedAt: string } | null; live: LiveStats; joined: LiveStats & { open: number }; open: number; expiredBeforeEntry: number; entryRejected: number; recent: { symbol: string; exitTime: number | null; reason: string | null; netPct: N; net: N }[] }
export interface SetupAccuracy { id: string; label: string; expected: { netPct: N; winRatePct: N; source: string }; live: LiveStats; policies: string[]; net: N; open: number }
export interface AccuracyResponse { version: string; computedAt: string; minTrades: number; rules: RuleAccuracy[]; setups: SetupAccuracy[]; bookStartedAt: string | null; unavailable: string[]; gapFill?: GapFill | null }
export async function fetchAccuracy(): Promise<AccuracyResponse> {
 const r = await fetch(apiUrl('/api/accuracy'), { signal: AbortSignal.timeout(30000) });
 const b = await r.json().catch(() => ({ error: 'Accuracy service returned a page instead of JSON' }));
 if (!r.ok) throw new Error(b.error ?? 'Accuracy unavailable');
 return b as AccuracyResponse;
}
