import type { StrategySpec } from '../../shared/strategySpec';
import { apiUrl } from '../utils/apiUrl';
export interface PaperOptions { capital: number; costBps: number; costPerOrder: number; slippageBps: number; maxUnitsPerOrder: number | null }
export interface PaperRunSummary {
 id: string; createdAt: string; updatedAt: string; status: 'ACTIVE' | 'STOPPED'; version: number; name: string; underlying: StrategySpec['underlying']; timeframe: string; options: PaperOptions;
 position: 'FLAT' | 'OPEN'; pending: { kind: string; reason?: string } | null; netPnl: number; realized: number; costs: number; orders: number; trades: number; wins: number;
 legs: { id: string; dir: number; units: number; entry: number; mark: number; open: boolean; stop: number | null; target: number | null; exitReason: string | null; contract: string | null }[];
 entries: { time: number; exitTime: number | null; reason: string | null; pnl: number | null; mae: number; mfe: number }[];
 events: { time: number; kind: string; [k: string]: unknown }[];
 paper: { lastBarTime: number | null; lastCycleAt: string | null; cycles: number; missedBars: number; droppedEvents: number; lastOutcome: string | null };
}
async function call<T>(init?: RequestInit): Promise<T> {
 const r = await fetch(apiUrl('/api/spec-paper'), { ...init, signal: AbortSignal.timeout(30000), headers: init?.body ? { 'Content-Type': 'application/json' } : undefined });
 const b = await r.json().catch(() => ({ error: 'Spec paper service returned a page instead of JSON' }));
 if (!r.ok) throw new Error(b.error + (Array.isArray(b.issues) ? ': ' + b.issues.map((i: { path: string; message: string }) => `${i.path} ${i.message}`).join('; ') : ''));
 return b as T;
}
export const listRuns = () => call<{ runs: PaperRunSummary[] }>().then(b => b.runs);
export const createRun = (spec: StrategySpec, options: PaperOptions, id = crypto.randomUUID()) => call<{ run: PaperRunSummary }>({ method: 'POST', body: JSON.stringify({ action: 'create', id, spec, options }) }).then(b => b.run);
export const stopRun = (id: string) => call<{ run: PaperRunSummary }>({ method: 'POST', body: JSON.stringify({ action: 'stop', id }) }).then(b => b.run);
