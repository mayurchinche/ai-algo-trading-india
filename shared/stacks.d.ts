export interface StackCondition { metric: string; by: 'percentile' | 'value'; op: 'gte' | 'lte'; at: number }
export interface StackDefinition { id: string; title: string; thesis: string; conditions: readonly StackCondition[]; priceSelected?: boolean; noWeakStyle?: boolean }
export interface StackReason { metric: string; label: string; value: number | null; percentile: number | null; text: string; display: string; warnings: string[] }
export interface StackMember { symbol: string; isin: string; industry: string | null; rank: number | null; why: StackReason[] }
export interface Stack { id: string; title: string; thesis: string; rule: string; priceSelected: boolean; status: 'LISTED' | 'TOO_FEW_MEMBERS'; qualifying: number; members: StackMember[] }
export interface Stacks { version: string; computedAt: string | null; peerGroups: { periodEnd: string; size: number }[]; companies: number; stacks: Stack[]; note: string }
export const STACKS_VERSION: string;
export const MAX_MEMBERS: number;
export const MIN_MEMBERS: number;
export const STACKS: readonly StackDefinition[];
export function conditionText(c: StackCondition): string;
export function ruleText(s: StackDefinition): string;
export function buildStacks(scorecards: unknown, universe?: readonly { symbol: string; industry?: string }[]): Stacks;
