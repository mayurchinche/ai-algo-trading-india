# The "164 Trading Strategy Browser" (megacellar-browser.onrender.com), checked

Checked on 22 Oct 2026. Scripts: `research/megacellarReplication.mjs` (`us` or `nifty`) and
`research/momentumRotationStudy.mjs`.

## What the site is

A static page (`index.html`, `js/app.js`, SHA-256 `ba629662…a399`) that loads `data/strategies.json`,
`data/descriptions.json` and one result file per strategy and window. REA's static JavaScript analysis
(Evidence `ev_bdc16a7e…`) found four fetches, all to those files; nothing else is computed in the page.
The strategy code is linked to a Google Drive folder that is not part of the site and was not used.

- 164 strategies, each run with 8 windows (7, 14, 21, 28 "weekly", 30–180 "monthly"), 1,310 results.
- Every result is on the same basket of 10 US stocks (CL, KO, PG, PEP, MMM, TGT, JNJ, LOW, MDT, MCD), daily data
  2000–2024 (6,289 days). Nothing on Indian stocks.
- Each result reports only total return, benchmark return (+975%) and the difference. No trades, costs, drawdown,
  win rate or out-of-sample period.
- Claimed: 140–153 of 164 beat the benchmark per window; median outperformance about +4,800% (7–28 day windows).

## What the strategies are

Each "strategy" is a one-step price predictor over a rolling window of closes (descriptions: "predicts the
maximum price in the window", "predicts the SMA of rolling maximums", "blend of the current price and the window
mean"). By description: 68 smoothing/statistics predictors, 48 mean reversion, 32 switching between reversion
and trend, 16 trend/momentum. A predictor that forecasts a smoothed value forecasts a rise for whatever is below
its recent level, so most of the 164 express one idea: short-term reversal.

## Reproduction (their basket, their dates)

Harness hypothesis: each day, hold the stocks with a positive predicted return, weighted by it.

| Predictor (window) | No costs | Benchmark | Turnover/yr | Daily, 0.05% cost | Weekly, 0.05% cost |
|---|---|---|---|---|---|
| Window maximum (7) | +4,853% (CAGR 16.9) | +929% | 149× | CAGR 8.5 | CAGR 13.2 |
| Smoothed maximum (30) | +12,715% (CAGR 21.6) | +1,045% | 90× | CAGR 16.2 | CAGR 12.8 |
| ATR blend (30) | +11,877% (CAGR 21.3) | +1,045% | 94× | CAGR 15.7 | CAGR 12.1 |
| Plain window mean (30) | +9,918% (CAGR 20.4) | +1,045% | 94× | CAGR 14.8 | CAGR 11.9 |

The benchmark and the order of magnitude match the site, so the harness reading is plausible (exact parameters
are unknown). A plain window mean does as well as the elaborate predictors, and turnover of 90–190× a year means
even a 0.05% cost removes about half of the excess return.

## On NIFTY 50 with Indian delivery charges

45 members with ~10 years of history, 2017–2026, delivery cost 0.19% each way.

| Predictor (window) | No costs | Equal-weight hold | Daily + costs | Weekly + costs |
|---|---|---|---|---|
| Window maximum (30) | +485% | +480% | CAGR 7.2 | CAGR 17.3 |
| ATR blend (30) | +423% | +480% | CAGR −0.9 | CAGR 16.1 |
| Plain window mean (7) | +311% | +502% | CAGR −20.1 | CAGR 6.0 |
| Trough count reversion (7) | +461% | +502% | CAGR −43.3 | CAGR 5.8 |
| Momentum (30) | +742% | +480% | CAGR 11.5 | CAGR 15.9 |

Equal-weight holding returned about 20% a year. No reversal predictor beat it even before costs; after costs
every version trailed it. The only predictor ahead before costs was 30-day momentum, the opposite of their edge.

A low-turnover momentum rotation (top 10 by 12-1 month return, monthly) made 22.0% a year after costs against
20.2% for equal weight, with a deeper drawdown (41% vs 37%), lagging in the first half of the period and leading
in the second: not a consistent improvement.

## Decision

None of the 164 strategies is added. Their reported performance comes from daily reversal trading on 10 US
stocks with no costs; on NIFTY 50 with Indian charges it underperforms simply holding the stocks. The app's
validation gate (profit after charges across the universe and in both halves of the history) remains the
standard, and the validated trend and breakout rules remain the best-evidenced strategies here.

Limitations: survivorship bias (current index members); predictors re-implemented from one-line descriptions;
the site's own harness and parameters are not published on the site.
