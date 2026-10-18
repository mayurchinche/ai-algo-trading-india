export const METRICS_VERSION: string;
export interface Flag { id: string; detail: string }
export interface Metrics {
 status: 'OK'; version: string; totalReturn: number; cagr: number | null; maxDrawdown: number; sharpe: number | null; sortino: number | null; calmar: number | null;
 trades: { count: number; winRate: number | null; profitFactor: number | null; expectancy: number | null; averageWin: number | null; averageLoss: number | null; payoffRatio: number | null; averageMae: number | null; averageMfe: number | null };
 gross: { pnl: number; costs: number; net: number }; bestMonthShare: number | null; months: { month: string; pnl: number }[];
 monteCarlo: { paths: number; seed: number; finalReturn: { p5: number; p50: number; p95: number }; maxDrawdown: { p50: number; p95: number }; probabilityOfLoss: number } | null;
 split: { earlyMean: number; lateMean: number; signFlip: boolean } | null; flags: Flag[];
 grade: { grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'N/A'; score: number; deductions: { points: number; reason: string }[]; note: string };
}
export function computeMetrics(input: { curve: { time: number; equity: number }[]; trades: { pnl: number; grossPnl: number; mae: number; mfe: number; exitTime: number }[]; capital: number; costs: number; paramCount?: number; mcPaths?: number; seed?: number }): Metrics | { status: 'NO_DATA' };
