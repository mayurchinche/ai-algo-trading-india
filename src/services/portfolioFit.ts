import { NIFTY50_UNIVERSE } from '../../shared/universes';
import type { ReferenceEntry, PriceObservation } from '../../shared/portfolioFit';
import type { Holding } from '../../shared/holdingsImport';
import type { Scorecards } from './scorecards';
import { fetchHistorical } from './stockDiscovery';
import { assessRiskProfile, type QuestionId } from '../../shared/riskProfile';

export const PRICE_MAX_AGE_DAYS = 10;
const istToday = (now: number) => new Date(now + 19800000).toISOString().slice(0, 10);
type History = Awaited<ReturnType<typeof fetchHistorical>>;

// Latest completed daily close for one NSE symbol; stale or missing history is an explicit status.
export async function observeClose(symbol: string, now = Date.now(), fetch: (s: string) => Promise<History> = s => fetchHistorical(s)): Promise<PriceObservation> {
 let h: History;
 try { h = await fetch(symbol + '.NS'); } catch { return { status: 'PRICE_UNAVAILABLE' }; }
 if (!h || !h.dates.length) return { status: 'PRICE_UNAVAILABLE' };
 const date = h.dates[h.dates.length - 1], close = h.closes[h.closes.length - 1];
 if ((Date.parse(istToday(now)) - Date.parse(date)) / 86400000 > PRICE_MAX_AGE_DAYS) return { status: 'PRICE_STALE', date };
 return { status: 'OBSERVED', close, date };
}
export async function priceHoldings(holdings: Holding[], reference: Map<string, ReferenceEntry>, { concurrency = 5, observe = (s: string) => observeClose(s) }: { concurrency?: number; observe?: (symbol: string) => Promise<PriceObservation> } = {}) {
 const symbols = [...new Set(holdings.map(h => h.symbol ?? (h.isin ? reference.get(h.isin)?.symbol : undefined)).filter((s): s is string => !!s))];
 const prices = new Map<string, PriceObservation>();let next = 0;
 await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, async () => { while (next < symbols.length) { const s = symbols[next++]; prices.set(s, await observe(s)); } }));
 return prices;
}
// NSE industry for NIFTY 50 constituents, plus filing support and Value score when scorecards loaded.
export function buildReference(scorecards: Scorecards | null) {
 const reference = new Map<string, ReferenceEntry>();
 for (const m of NIFTY50_UNIVERSE.members) {
  const card = scorecards?.companies.find(c => c.isin === m.isin);
  const entry: ReferenceEntry = { symbol: m.symbol, isin: m.isin, industry: m.industry, supportedFiling: card ? !!card.basis : null, valueScore: card?.styles.find(s => s.id === 'value')?.score ?? null };
  reference.set(m.isin, entry); reference.set(m.symbol, entry);
 }
 return reference;
}

export const RISK_ANSWERS_KEY = 'risk_profile_answers_v1';
// Stored answers are re-validated; anything unusable reads as unanswered.
export function loadRiskAnswers(): Partial<Record<QuestionId, number>> {
 try { const v = JSON.parse(localStorage.getItem(RISK_ANSWERS_KEY) ?? '{}'); assessRiskProfile(v); return v; } catch { return {}; }
}
