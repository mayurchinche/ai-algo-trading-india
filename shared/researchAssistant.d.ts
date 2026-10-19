export type AssistantIntent = 'EMPTY' | 'UNKNOWN' | 'NEEDS_INPUT' | 'ANALYSE' | 'COMPARE' | 'SCREEN' | 'SIGNALS' | 'GAPS' | 'PORTFOLIO_FIT';
export interface AssistantFilter { column: string; op: 'gte' | 'lte'; value: number }
export interface AssistantPlan {
 version: string; question: string; intent: AssistantIntent; symbols: string[]; industry: string | null;
 screen: { filters: AssistantFilter[]; sortBy: string; sortDirection: 'asc' | 'desc'; limit: number } | null;
 understood: string[]; ignored: string[]; message?: string;
}
export const ASSISTANT_VERSION: string;
export const MAX_RESULTS: number;
export const DEFAULT_RESULTS: number;
export const STYLE_WORDS: Readonly<Record<string, string>>;
export function parseQuestion(text: unknown, options?: { universe?: readonly { symbol: string; industry?: string }[] }): AssistantPlan;
export const PROMPT_LIBRARY: readonly { group: string; prompts: string[] }[];
