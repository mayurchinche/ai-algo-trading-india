export const TREND_VALIDATION: {
 model: string; study: string; runOn: string; universe: string; status: 'PASSED_PRE_DECLARED_CRITERIA' | 'NOT_VALIDATED';
 closedTrades: number; meanNetTradePct: number; medianNetTradePct: number; winRatePct: number;
 forwardExcessPct: { firstHalf: number; secondHalf: number };
 beatBuyAndHold: { symbols: number; of: number }; medianMaxDrawdownPct: { strategy: number; buyAndHold: number };
 recentYears: { year: number; trades: number; meanNetPct: number }[]; summary: string;
};
