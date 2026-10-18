import type { Condition, PriceField, StrategySpec } from './strategySpec';

export interface Bar { time: number; open: number; high: number; low: number; close: number; volume: number }
export interface StrategySeries {
  length: number;
  price: Record<PriceField | 'time', number[]>;
  indicators: Record<string, { defaultOutput: string; outputs: Record<string, number[]> }>;
}

export function computeStrategySeries(spec: Readonly<StrategySpec>, bars: readonly Bar[]): StrategySeries;
/** true / false, or null when an operand is still in warm-up or before the first bar. */
export function evaluateCondition(condition: Condition, ctx: StrategySeries, index: number): boolean | null;
