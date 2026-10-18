import type { StrategySpec } from './strategySpec';
import type { Bar } from './strategyConditions';
import type { Metrics } from './backtestMetrics';
import type { TradeLeg } from './specEngine';
export const BACKTEST_VERSION: string;
export interface BacktestTrade { entryTime: number; exitTime: number; reason: string; pnl: number; grossPnl: number; charges: number; mae: number; mfe: number; legs: TradeLeg[] }
export interface BacktestOptions { capital?: number; costModel?: 'flat' | 'broker-tariff'; costBps?: number; costPerOrder?: number; slippageBps?: number; lotSize?: number | null; maxUnitsPerOrder?: number | null; mcPaths?: number; seed?: number }
export type BacktestResult =
 | { status: 'UNSUPPORTED_OPTION_LEGS'; legs: string[]; reason: string }
 | { status: 'LOT_SIZE_REQUIRED' | 'INSUFFICIENT_BARS' }
 | { status: 'OK'; version: string; spec: { name: string; timeframe: string }; period: { from: number; to: number; bars: number }; options: Required<Omit<BacktestOptions, 'mcPaths' | 'seed'>>; curve: { time: number; equity: number }[]; trades: BacktestTrade[]; openTrade: { entryTime: number } | null; orders: number; ambiguousBars: number; metrics: Metrics | { status: 'NO_DATA' }; limitations: string[] };
export function runSpecBacktest(spec: Readonly<StrategySpec>, bars: readonly Bar[], options?: BacktestOptions): BacktestResult;
