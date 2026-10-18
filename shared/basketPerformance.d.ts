export interface DailyCloses { dates: string[]; closes: number[] }
export interface BasketPoint { date: string; basket: number; benchmark: number; fd: number }
export type BasketPerformance =
 | { status: 'NO_BENCHMARK_DATA'; members: []; series: [] }
 | { status: 'NO_MEMBER_DATA'; baseDate: string; members: []; excluded: { symbol: string; reason: string }[]; series: [] }
 | { status: 'MEASURED' | 'STARTED_TODAY'; baseDate: string; endDate: string; sessions: number; members: { symbol: string; returnPct: number; carriedForwardSessions: number }[]; excluded: { symbol: string; reason: string }[]; series: BasketPoint[]; summary: { basketPct: number; benchmarkPct: number; fdPct: number; excessVsBenchmarkPct: number; maxDrawdownPct: number }; method: string };
export function basketPerformance(input: { members: readonly string[]; closes: Map<string, DailyCloses>; benchmark: DailyCloses; startDate: string; fdRatePct: number }): BasketPerformance;
