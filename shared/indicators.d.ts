export type Series = number[];
export type Seed = 'sma' | 'first';
export type AverageMethod = 'wilder' | 'simple';

export function sma(values: Series, length: number): Series;
export function stdev(values: Series, length: number): Series;
export function ema(values: Series, length: number, options?: { seed?: Seed }): Series;
export function rma(values: Series, length: number): Series;
export function rsi(values: Series, length?: number, options?: { method?: AverageMethod }): Series;
export function macd(values: Series, options?: { fast?: number; slow?: number; signal?: number; seed?: Seed }): { macd: Series; signal: Series; histogram: Series };
export function trueRange(high: Series, low: Series, close: Series): Series;
export function atr(high: Series, low: Series, close: Series, length?: number, options?: { method?: AverageMethod }): Series;
export function bollinger(values: Series, length?: number, multiplier?: number): { middle: Series; upper: Series; lower: Series; percentB: Series };
export function highest(values: Series, length: number): Series;
export function lowest(values: Series, length: number): Series;
export function donchian(high: Series, low: Series, length?: number): { upper: Series; lower: Series; middle: Series };
export function zlema(values: Series, length: number): Series;
export function supertrend(high: Series, low: Series, close: Series, length?: number, multiplier?: number): { line: Series; direction: Series };
export function vwap(high: Series, low: Series, close: Series, volume: Series, sessions?: readonly unknown[]): Series;
export function technicalRating(high: Series, low: Series, close: Series, volume: Series): { rating: Series; maRating: Series; oscRating: Series };
export function crossover(a: Series, b: Series | number): boolean[];
export function crossunder(a: Series, b: Series | number): boolean[];

export function openingRange(open: Series, high: Series, low: Series, close: Series, sessions: string[], bars: number): { high: number[]; low: number[]; open: number[]; close: number[]; prevClose: number[]; gapPct: number[] };
export function gapPercent(open: Series, close: Series): number[];
export function volumeRatio(volume: Series, length: number): number[];
