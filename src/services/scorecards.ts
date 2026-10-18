import { apiUrl } from '../utils/apiUrl';

export type StyleId = 'value' | 'garp' | 'growth' | 'compounder' | 'momentum';
export interface Criterion { metric: string; label: string; weight: number; direction: 'higher' | 'lower'; value: number | null; inputStatus: string; warnings: string[]; peers: number; percentile: number | null; status: 'RANKED' | 'INPUT_UNAVAILABLE' | 'TOO_FEW_PEERS' }
export interface StyleScore { id: StyleId; label: string; coverage: number; status: 'SCORED' | 'INSUFFICIENT_INPUTS'; score: number | null; partialScore: number | null; missing: string[]; warnings: string[]; criteria: Criterion[] }
export interface Metric { value: number | null; status: string; warnings?: string[] }
export interface CompanyScorecard {
 symbol: string; isin: string; instrumentKey: string;
 basis: { scope: 'Consolidated' | 'Standalone'; period: { start: string; end: string } } | null;
 peerGroup: { periodEnd: string; size: number } | null;
 metrics: Record<string, Metric>; sources: { url: string; publishedAt: string; symbol?: string }[];
 styles: StyleScore[]; composite: { status: 'SCORED' | 'INSUFFICIENT_STYLES'; score: number | null; styles: StyleId[] };
}
export interface Scorecards {
 universe: { name: string; asOf: string; source: string }; computedAt: string; version: string;
 styles: { id: StyleId; label: string; inspiration: string; criteria: { metric: string; weight: number; label: string; direction: string }[] }[];
 rules: { minPeers: number; minCoverage: number; minStylesForComposite: number; percentile: string; peerGroup: string; composite: string };
 peerGroups: { periodEnd: string; size: number }[]; companies: CompanyScorecard[];
 coverage: { companies: number; withAnnualPeriod: number; withPrice: number; truncatedFilingReads: number };
 disclaimer: string; limitations: string[];
}

export async function fetchScorecards(universe = 'NIFTY50', signal?: AbortSignal): Promise<Scorecards> {
 const r = await fetch(apiUrl('/api/scorecards?universe=' + universe), { signal: signal ?? AbortSignal.timeout(60000) });
 let body: { error?: string } & Partial<Scorecards>;
 try { body = await r.json(); } catch { throw new Error('Scorecard service returned a page instead of JSON. Check the API deployment.'); }
 if (!r.ok) throw new Error(body.error || `Scorecards unavailable (HTTP ${r.status})`);
 return body as Scorecards;
}

export type SortKey = StyleId | 'composite';
export const scoreFor = (c: CompanyScorecard, key: SortKey) => key === 'composite' ? c.composite.score : c.styles.find(s => s.id === key)?.score ?? null;
// Scored companies first by descending score; unscored keep symbol order.
export function sortScorecards(companies: CompanyScorecard[], key: SortKey) {
 return [...companies].sort((a, b) => (scoreFor(b, key) ?? -1) - (scoreFor(a, key) ?? -1) || a.symbol.localeCompare(b.symbol));
}
export const formatMetric = (m: Metric | undefined, unit: '%' | 'x') => m && m.value !== null && Number.isFinite(m.value) ? m.value.toFixed(unit === '%' ? 1 : 2) + (unit === '%' ? '%' : '') : '—';
export const readable = (status: string) => status.replaceAll('_', ' ').toLowerCase();
