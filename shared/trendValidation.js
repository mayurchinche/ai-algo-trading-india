// Recorded evidence for trend-score-v1. The dashboard shows this with every signal; it is not re-derived in the browser.
// Source: docs/TREND_SCORE_RESEARCH.md (study outputs are kept outside Git with their input and source hashes).
export const TREND_VALIDATION=Object.freeze({
 model:'trend-score-v1',study:'trend-score-v1-replay-v1',runOn:'2026-10-18',
 universe:'NIFTY 50 constituents on 2026-10-18, applied to 2016–2026 daily history (survivorship bias)',
 status:'PASSED_PRE_DECLARED_CRITERIA',
 closedTrades:3310,meanNetTradePct:1.00,medianNetTradePct:-1.22,winRatePct:41.33,
 forwardExcessPct:{firstHalf:0.44,secondHalf:0.09},
 beatBuyAndHold:{symbols:1,of:50},medianMaxDrawdownPct:{strategy:40.45,buyAndHold:54.02},
 recentYears:[{year:2025,trades:372,meanNetPct:-0.87},{year:2026,trades:260,meanNetPct:-0.28}],
 summary:'Passed its minimum pre-declared checks over 2016–2026, but most trades lost (median −1.22% after costs), it trailed buy-and-hold in 49 of 50 stocks, and trades lost on average in 2025 and 2026. Treat signals as descriptions of trend state, not trade recommendations.',
});
