import type { StrategySpec, SpecIssue, Expiry } from './strategySpec';
import type { OptionChain } from './optionChain';
import type { Greeks } from './optionsMath';
export type PresetId = 'long-straddle' | 'short-straddle' | 'long-strangle' | 'short-strangle' | 'iron-condor' | 'butterfly' | 'covered-call' | 'protective-put' | 'collar' | 'jade-lizard' | 'calendar' | 'ratio';
export const PRESETS: Readonly<Record<PresetId, { label: string; view: string; legs: (p: { w: number; g: number }) => unknown[] }>>;
export const INDEX_UNDERLYINGS: readonly string[];
export interface WizardInput { preset: PresetId; underlying: string; kind: 'index' | 'equity'; expiry: Expiry; lots: number; w?: number; g?: number; mode?: 'intraday' | 'positional'; entryStart?: string; entryEnd?: string; squareOff?: string; legStopLossPct?: number; maxLossAmount?: number; targetAmount?: number }
export function buildWizardSpec(input: WizardInput): { ok: true; spec: Readonly<StrategySpec> } | { ok: false; issues: SpecIssue[] };
export type ResolvedLeg = { id: string; status: string; kind?: 'option' | 'future'; optionType?: 'CE' | 'PE'; sign?: number; lots?: number; lotSize?: number | null; strike?: number; entry?: number; iv?: number; expiry?: string | null; instrumentKey?: string | null; greeks?: Greeks | null; rate?: number };
export function resolveLegs(spec: Readonly<StrategySpec>, chains: Partial<Record<Expiry, OptionChain>>): ResolvedLeg[];
export type Payoff =
 | { status: 'UNRESOLVED_LEGS'; unresolved: ResolvedLeg[] }
 | { status: 'OK'; evaluatedAt: string | null; lotSize: 'FROM_CHAIN' | 'UNKNOWN_PER_UNIT'; curve: { price: number; pnl: number }[]; netPremium: number; maxProfit: { status: string; value: number }; maxLoss: { status: string; value: number }; breakevens: number[]; greeks: { delta: number; gamma: number; theta: number; vega: number }; notes: string[] };
export function payoff(legs: ResolvedLeg[], range: { spot: number; from?: number; to?: number; points?: number }): Payoff;
