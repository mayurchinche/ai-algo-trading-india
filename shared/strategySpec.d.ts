export const STRATEGY_SCHEMA_VERSION: 1;
export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '1d';
export type Expiry = 'current-week' | 'next-week' | 'current-month' | 'next-month';
export type PriceField = 'open' | 'high' | 'low' | 'close' | 'volume';
export type Source = PriceField | 'hl2' | 'hlc3';
export type Comparator = 'gt' | 'gte' | 'lt' | 'lte' | 'crosses-above' | 'crosses-below';
export type IndicatorType = 'sma' | 'ema' | 'zlema' | 'rsi' | 'highest' | 'lowest' | 'atr' | 'macd' | 'bollinger' | 'supertrend' | 'donchian' | 'vwap';

export const TIMEFRAMES: readonly Timeframe[];
export const EXPIRIES: readonly Expiry[];
export const PRICE_FIELDS: readonly PriceField[];
export const SOURCES: readonly Source[];
export const COMPARATORS: readonly Comparator[];
export const INDICATOR_TYPES: Readonly<Record<IndicatorType, { params: Record<string, [number, number, 'number'?]>; source: boolean; outputs: string[]; intradayOnly?: boolean }>>;

export interface IndicatorDefinition { id: string; type: IndicatorType; params?: Record<string, number>; source?: Source }

export type Operand =
  | { indicator: string; output?: string; barsAgo?: number }
  | { price: PriceField; barsAgo?: number }
  | { value: number };
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { compare: { left: Operand; op: Comparator; right: Operand } };

export interface LegLevel { unit: 'percent' | 'points'; value: number }
export type StrikeSelector =
  | { mode: 'atm-offset'; steps: number }
  | { mode: 'premium'; near: number }
  | { mode: 'delta'; near: number };
export type Instrument =
  | { type: 'equity' }
  | { type: 'future'; expiry: 'current-month' | 'next-month' }
  | { type: 'option'; optionType: 'CE' | 'PE'; expiry: Expiry; strike: StrikeSelector };
export interface Leg {
  id: string;
  side: 'BUY' | 'SELL';
  instrument: Instrument;
  quantity: { units: number } | { lots: number };
  target?: LegLevel;
  stopLoss?: LegLevel;
  trailingStop?: { unit: 'percent' | 'points'; trigger: number; step: number };
}
export interface StrategyAmount { unit: 'percent-capital' | 'amount'; value: number }

export interface StrategySpec {
  schemaVersion: 1;
  name: string;
  description?: string;
  mode: 'intraday' | 'positional';
  underlying: { symbol: string; exchange: 'NSE' | 'BSE'; kind: 'equity' | 'index' };
  timeframe: Timeframe;
  schedule: { weekdays: number[]; entryStart: string; entryEnd: string; squareOff?: string };
  indicators: IndicatorDefinition[];
  entry: Condition;
  exit?: Condition;
  legs: Leg[];
  risk?: {
    maxLoss?: StrategyAmount;
    target?: StrategyAmount;
    reEntry?: { maxCount: number; after: 'stop-loss' | 'target' | 'any'; cooldownMinutes?: number };
    exitOnExpiryDay?: boolean;
    maxHoldingDays?: number;
  };
}

export interface SpecIssue { path: string; message: string }
export function parseStrategySpec(input: unknown): { ok: true; spec: Readonly<StrategySpec> } | { ok: false; issues: SpecIssue[] };
