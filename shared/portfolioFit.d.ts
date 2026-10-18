import type { Holding } from './holdingsImport';
import type { ProfileLimits } from './riskProfile';
export type PriceObservation = { status: 'OBSERVED'; close: number; date: string } | { status: string; reason?: string; date?: string };
export interface ReferenceEntry { symbol: string; isin: string; industry?: string | null; supportedFiling?: boolean | null; valueScore?: number | null }
export interface FitPosition { symbol: string | null; isin: string | null; quantity: number; averagePrice: number | null; price: PriceObservation; value: number | null; costValue: number | null; industry: string | null; supportedFiling: boolean | null; valueScore: number | null; weightPct: number | null }
export interface FitCheck { id: string; label: string; limit: number; unit: '%' | 'count'; value: number | null; status: 'PASS' | 'BREACH' | 'UNKNOWN'; reason?: string; unpriced?: string[]; holding?: string | null; sector?: string | null; unclassifiedPct?: number }
export interface PortfolioFit {
 version: string; status: 'WITHIN_LIMITS' | 'OUTSIDE_LIMITS' | 'INCOMPLETE';
 totals: { marketValue: number | null; pricedValue: number; costValue: number | null };
 positions: FitPosition[]; checks: FitCheck[]; sectors: { industry: string; weightPct: number }[] | null; unpriced: string[];
 quality: { supportedFilingPct: number | null; valueScoreCoveragePct: number | null; weightedValueScore: number | null }; limitations: string[];
}
export const PORTFOLIO_FIT_VERSION: string;
export function assessPortfolioFit(input: { holdings: Holding[]; prices: Map<string, PriceObservation>; reference: Map<string, ReferenceEntry>; limits: Pick<ProfileLimits, 'maxStockPct' | 'maxTopFivePct' | 'maxSectorPct' | 'minHoldings'> }): PortfolioFit;
