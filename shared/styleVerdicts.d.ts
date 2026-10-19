export interface VerdictCriterion { metric: string; label: string; weight: number; value: number | null; percentile: number | null; status: string }
export interface VerdictItem { metric: string; label: string; value: number | null; percentile: number; weight: number }
export interface StyleVerdictResult { id: string; label: string; status: string; score: number | null; fit: 'STRONG_FIT' | 'PARTIAL_FIT' | 'WEAK_FIT' | 'NOT_SCORED'; plus: VerdictItem[]; minus: VerdictItem[]; neutral: number; unavailable: { metric: string; label: string; reason: string }[] }
export const VERDICT_RULES: Readonly<{ plusAt: number; minusAt: number; strongFitAt: number; weakFitAt: number }>;
export function styleVerdict(style: { id: string; label: string; status: string; score: number | null; criteria: VerdictCriterion[] } | null | undefined): StyleVerdictResult;
export function styleVerdicts(company: { styles: { id: string; label: string; status: string; score: number | null; criteria: VerdictCriterion[] }[] } | null | undefined): StyleVerdictResult[];
export function verdictSentence(v: StyleVerdictResult): string;
