import type { StrategySpec } from './strategySpec';
import type { StrategySeries } from './strategyConditions';
export { computeStrategySeries } from './strategyConditions';
export const ENGINE_VERSION: string;
export const TIMEFRAME_MS: Readonly<Record<StrategySpec['timeframe'], number>>;
export interface EngineOptions { capital: number; costBps?: number; costPerOrder?: number; slippageBps?: number; lotSize?: number | null; maxUnitsPerOrder?: number | null }
export interface LegQuote { open: number; high: number; low: number; close: number; bid?: number | null; ask?: number | null; instrument?: unknown; lotSize?: number | null }
export interface EngineLeg { id: string; dir: 1 | -1; units: number; entry: number; instrument: unknown; open: boolean; stop: number | null; target: number | null; trailSteps: number; mark: number; exitReason?: string }
export interface EngineEntry { index: number; day: string; time: number; decidedAt: number; exitTime: number | null; reason: string | null; pnl: number | null; mae: number; mfe: number; costsBefore: number; realizedBefore: number }
export interface EngineEvent { time: number; kind: string; [k: string]: unknown }
export interface EngineState { version: string; status: 'FLAT' | 'OPEN'; legs: EngineLeg[]; pending: { kind: 'ENTRY' | 'EXIT'; time: number; reason?: string } | null; realized: number; costs: number; orders: number; entries: EngineEntry[]; dayEntries: Record<string, number>; lastExit: { time: number; reason: string; day: string } | null; armed: boolean; ambiguousBars: number; events: EngineEvent[]; options: Required<EngineOptions>; lastLegExit?: string }
export function createEngineState(spec: Readonly<StrategySpec>, options: EngineOptions): EngineState;
export function stepEngine(spec: Readonly<StrategySpec>, state: EngineState, series: StrategySeries, i: number, quotes: Record<string, LegQuote | undefined> | null): EngineState;
export function markToMarket(state: EngineState): number;
