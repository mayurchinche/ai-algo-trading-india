import type { StrategySpec } from './strategySpec';
import type { StrategySeries } from './strategyConditions';
export { computeStrategySeries } from './strategyConditions';
export const ENGINE_VERSION: string;
export const TIMEFRAME_MS: Readonly<Record<StrategySpec['timeframe'], number>>;
export interface EngineOptions { capital: number; costModel?: 'flat' | 'broker-tariff'; requireMargin?: boolean; costBps?: number; costPerOrder?: number; slippageBps?: number; lotSize?: number | null; maxUnitsPerOrder?: number | null }
export interface BookLevel { price: number; quantity: number }
export interface SubBar { time: number; open: number; high: number; low: number; close: number; ref?: number; source?: string }
export interface LegQuote { open: number; high: number; low: number; close: number; bid?: number | null; ask?: number | null; depth?: { buy: BookLevel[]; sell: BookLevel[] } | null; bars?: SubBar[]; barSource?: string; timestamp?: string; source?: string; instrument?: { instrumentKey: string; description?: string; lotSize?: number } | null; lotSize?: number | null }
export interface TradeLeg { leg: string; instrumentKey: string | null; contract: string | null; side: 'BUY' | 'SELL'; units: number; entryPrice: number; entryTime: number; exitPrice: number; exitTime: number; exitReason: string; gross: number; charges: number }
export interface StepContext { at?: number; entryMargin?: { status: 'OK'; required: number } | { status: string; reason?: string } }
export interface EngineLeg { id: string; dir: 1 | -1; units: number; entry: number; entryTime: number; entryCharges: number; instrument: LegQuote['instrument']; open: boolean; stop: number | null; target: number | null; trailSteps: number; mark: number; exitPrice: number | null; exitTime: number | null; exitCharges: number; exitReason?: string; checkedTo?: number }
export interface EngineEntry { index: number; tradeId: string; day: string; time: number; decidedAt: number; exitTime: number | null; reason: string | null; pnl: number | null; gross?: number; charges?: number; legs?: TradeLeg[]; mae: number; mfe: number; costsBefore: number; realizedBefore: number; margin: number }
export interface EngineEvent { time: number; kind: string; [k: string]: unknown }
export interface EngineState { version: string; status: 'FLAT' | 'OPEN'; legs: EngineLeg[]; pending: { kind: 'ENTRY' | 'EXIT'; time: number; reason?: string } | null; realized: number; costs: number; orders: number; entries: EngineEntry[]; dayEntries: Record<string, number>; lastExit: { time: number; reason: string; day: string } | null; armed: boolean; ambiguousBars: number; orderSeq: number; tradeSeq: number; blocked: number; events: EngineEvent[]; options: Required<EngineOptions>; lastLegExit?: string }
export function createEngineState(spec: Readonly<StrategySpec>, options: EngineOptions): EngineState;
export function stepEngine(spec: Readonly<StrategySpec>, state: EngineState, series: StrategySeries, i: number, quotes: Record<string, LegQuote | undefined> | null, ctx?: StepContext): EngineState;
export function fillPending(spec: Readonly<StrategySpec>, state: EngineState, quotes: Record<string, LegQuote | undefined> | null, ctx?: StepContext, time?: number): EngineState;
export function monitorEngine(spec: Readonly<StrategySpec>, state: EngineState, quotes: Record<string, LegQuote | undefined> | null, ctx: StepContext & { at: number }): EngineState;
export function unitsOf(leg: StrategySpec['legs'][number], lotSize: number | null | undefined): number;
export function rollLeg(spec: Readonly<StrategySpec>, state: EngineState, legId: string, oldQuote: LegQuote | undefined, newQuote: LegQuote | undefined, ctx: StepContext & { at: number }): EngineState;
export function walkBook(levels: BookLevel[] | undefined, units: number): { filled: number; remaining: number; value: number; used: BookLevel[] };
export function fundsOf(state: EngineState): { capital: number; realized: number; charges: number; ledger: number; blocked: number; available: number; unrealized: number; equity: number };
export function markToMarket(state: EngineState): number;
export function closeAtMarks(spec: Readonly<StrategySpec>, state: EngineState, time: number, reason: string): EngineState;
