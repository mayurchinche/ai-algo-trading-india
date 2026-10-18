export interface UniverseMember { readonly symbol: string; readonly isin: string; readonly industry: string }
export const NIFTY50_UNIVERSE: { name: string; asOf: string; source: string; sourceSha256: string; members: readonly UniverseMember[]; symbols: readonly string[] };
