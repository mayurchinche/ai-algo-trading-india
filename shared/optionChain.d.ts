import type { Greeks, OptionType } from './optionsMath';
import type { StrikeSelector } from './strategySpec';
export interface ChainQuote { instrumentKey: string | null; ltp: number | null; close: number | null; bid: number | null; ask: number | null; bidQty: number | null; askQty: number | null; oi: number | null; volume: number | null; mid: number | null; iv: number | null; ivStatus: string; greeks: Greeks | null; provider: { iv: number | null; delta: number | null; gamma: number | null; theta: number | null; vega: number | null } | null; lotSize?: number | null }
export interface ChainStrike { strike: number; CE: ChainQuote | null; PE: ChainQuote | null }
export interface OptionChain { underlying: string; underlyingKey: string; expiry: string; spot: number; observedAt: string; yearsToExpiry: number; model: { version: string; rate: number; dividendYield: number; price: string; underlyingPrice: string }; strikeStep: number | null; atmStrike: number; strikes: ChainStrike[] }
export const DEFAULT_RATE: number;
export function normalizeOptionChain(rows: unknown[], ctx: { underlying: string; underlyingKey: string; observedAt: string; rate?: number; dividendYield?: number }): OptionChain;
export function selectStrike(chain: OptionChain, optionType: OptionType, selector: StrikeSelector): { status: 'SELECTED'; strike: number; contract: ChainQuote; matched?: number } | { status: string; strike?: undefined };
