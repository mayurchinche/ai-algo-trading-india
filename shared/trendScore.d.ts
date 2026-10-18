export type TrendZone = 'BULLISH' | 'NEUTRAL' | 'BEARISH';
export interface TrendModel { id: string; zlemaLength: number; atrLength: number; slopeBars: number; bandAtr: number; bullish: number; bearish: number; recentSessions: number; formula: string; signals: string }
export interface TrendSignal { index: number; date: string; type: 'BUY' | 'SELL'; score: number }
export type TrendLatest =
 | { status: 'INSUFFICIENT_HISTORY'; date: string | null }
 | { status: 'SCORED'; index: number; date: string; close: number; score: number; zone: TrendZone; inTrend: boolean; lastSignal: TrendSignal | null; sessionsSinceSignal: number | null; category: 'TREND_START' | 'TREND_END' | null };
export interface TrendResult { model: TrendModel; dates: string[]; close: number[]; zlema: (number | null)[]; atr: (number | null)[]; score: (number | null)[]; zone: (TrendZone | null)[]; signals: TrendSignal[]; latest: TrendLatest }
export const TREND_MODEL: TrendModel;
export function trendZone(score: number | null, model?: TrendModel): TrendZone | null;
export function computeTrendScore(input: { dates: string[]; close: number[]; high: number[]; low: number[] }, model?: TrendModel): TrendResult;
