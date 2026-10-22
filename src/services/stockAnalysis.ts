import { apiUrl } from '../utils/apiUrl';
import type { Signal } from './signals';
type N = number | null;
import type { StyleVerdictResult } from '../../shared/styleVerdicts';
export type StyleVerdict = StyleVerdictResult;
export type { VerdictItem } from '../../shared/styleVerdicts';
export interface Fact { label: string; value: number | string | null; unit: string }
export interface SwotItem { text: string; basis: string[] }
export interface Technicals {
 status: string; asOf: string; close: number; change1dPct: N; returnsPct: Record<'1w' | '1m' | '3m' | '6m' | '1y', N>;
 movingAverages: { sma20: N; sma50: N; sma200: N; ema20: N; sma200Rising: boolean | null }; momentum: { rsi14: N; macd: N; macdSignal: N; macdHistogram: N };
 volatility: { atr14: N; atrPct: N; annualised20dPct: N; percentileOf1y: N; avgDailyRangePct: number; avgOpeningGapPct: N };
 bands: { bollingerUpper: N; bollingerLower: N; percentB: N; supertrend: N; supertrendDirection: N }; range: { high52w: number; low52w: number; belowHighPct: number; aboveLowPct: number };
 levels: { pivot: number; r1: number; s1: number; resistance20d: N; support20d: N; resistance55d: N; support55d: N }; volume: { last: number; avg20: number; ratio: N };
 trendScore: { status: string; score?: number; zone?: string; inTrend?: boolean } | null; rating?: { value: number; ma: number; oscillators: number; band: string } | null; reason?: string;
}
export interface Ratio { key: string; label?: string; value: N; status: string; formula?: string }
export interface Analysis {
 status: 'OK'; symbol: string; name: string; instrumentKey: string; isIndex: boolean; industry: string | null; computedAt: string;
 quote: { price: number; bid: number; ask: number; spreadPct: number; timestamp: string } | { status: string; reason: string | null };
 futures: { nearest: { symbol: string; expiry: string; lotSize: number; price: N; basisPct: N }; next: { symbol: string; expiry: string } | null } | null;
 technicals: Technicals; fundamentals: { scopes?: Record<string, { format?: 'BANKING' | 'INDAS'; latestAnnualPeriod: { start: string; end: string } | null; ratios: Ratio[]; growth: { key: string; years: number; valuePct: N; status: string }[]; marketCap?: { value: N; status: string } }> } & { status?: string };
 peerRanks: { metric: string; label: string; value: number; percentile: number; peers: number }[];
 scorecard: { composite: { status: string; score: N }; styles: { id: string; label: string; status: string; score: N }[]; verdicts?: StyleVerdict[] } | null;
 news: { articles: { title: string; link: string | null; source: string; publishedAt: string; tone: string }[]; summary: { status: string; counts: Record<string, number>; method: string } } | { status: string };
 announcements: { date: string | null; time: string | null; subject: string; text: string; url: string | null }[] | { status: string; reason?: string };
 deals: { count: number; buyValue: number; sellValue: number; netValue: number; rows: { date: string; kind: string; client: string; side: string; quantity: number; price: number }[]; coverage: string } | { status: string };
 delivery: { latest: { date: string; deliveryPct: N; volume: N }; average: N; days: number; history: { date: string; deliveryPct: N; volume: N; close: N }[] } | { status: string };
 flows: { date: string; category: string; buy: number; sell: number; net: number }[];
 optionChain: { expiry: string; spot: number; atmStrike: number; putCallOiRatio: N; maxPain: N; atmIv: { CE: N; PE: N }; callOiWall: { strike: number; oi: number }[]; putOiWall: { strike: number; oi: number }[]; lotSize: N } | { status: string };
 validations: { strategyId: string; verdict: string; reasons: string[] }[]; signals: Signal[];
 strategyStates: { strategyId: string; segment: string; name: string; state: string; since: string | null }[];
 swot: { strengths: SwotItem[]; weaknesses: SwotItem[]; opportunities: SwotItem[]; threats: SwotItem[]; method: string };
 segments: { id: string; label: string; horizon: string; facts: Fact[]; strategies: { id: string; name: string; verdict: string; stats: { trades: number; winRate: N; expectancyPct: N; profitFactor: N } | null; buyHoldPct: N; state: string | null; since: string | null }[]; fundamentalsNote: string | null }[];
 limitations: string[];
}
export async function fetchAnalysis(symbol: string): Promise<Analysis> {
 const r = await fetch(apiUrl('/api/stock-analysis?symbol=' + encodeURIComponent(symbol)), { signal: AbortSignal.timeout(60000) });
 const b = await r.json().catch(() => ({ error: 'Analysis service returned a page instead of JSON' }));
 if (r.status === 404) throw new Error(`${symbol} is not an NSE equity symbol (or NIFTY / BANKNIFTY).`);
 if (!r.ok) throw new Error(b.error ?? 'Analysis unavailable');
 return b as Analysis;
}
