# Discover score study (2026-10-19)

**Question.** Is the Discover composite score accurate enough to alert on? Should the threshold move from 70 to 60?

**Method** (`scripts/research/discovery-score-replay.ts`):
- **Scoring.** The unchanged `evaluateDiscoverySnapshot` scores every stock-day in 10 years of Yahoo daily bars (2016–2026). Each day uses bars up to and including that day, with that day's close and volume, as a scan near the close would.
- **Universe.** The 475 NIFTY 500 stocks with enough history (constituents on 19 Oct 2026, applied to all past years).
- **Outcomes.** Measured from the next session's open, in the signal's direction:
  - next-day intraday (open to close, after intraday charges);
  - 1-, 5- and 10-day returns;
  - whether the scanner's own target (+3 ATR) or stop (−2 ATR) was hit first within 10 sessions. When one day touches both, the stop counts first.
- **Charges.** Round trip on ₹1 lakh, from `shared/brokerCharges.js`: 0.238% delivery, 0.083% intraday.

**Bundle and run:**
```sh
npx esbuild scripts/research/discovery-score-replay.ts --bundle --platform=node --format=esm --packages=external --outfile=.research/discovery-score-replay.mjs
node --max-old-space-size=4096 .research/discovery-score-replay.mjs <dir of 10y daily chart JSON> out.json
```

## Results

Baseline: across all 869,351 stock-days, the average long 10-day return was **+0.65%**.

| Score band | Stock-days | Next-day intraday, net | 5 days | 10 days | 10 days vs baseline | Target first | Stop first |
|---|---|---|---|---|---|---|---|
| BUY 0–39 | 452,366 | −0.21% | +0.26% | +0.73% | +0.08 | 18.8% | 29.5% |
| BUY 40–49 | 17,135 | −0.26% | +0.39% | +1.11% | +0.46 | 21.4% | 27.5% |
| BUY 50–59 | 14,602 | −0.27% | +0.26% | +0.94% | +0.29 | 21.8% | 29.4% |
| BUY 60–69 | 8,152 | −0.34% | +0.29% | +0.98% | +0.33 | 24.6% | 30.2% |
| BUY 70+ | 34 | −0.39% | +0.81% | +1.75% | +1.10 | 14.7% | 20.6% |
| SELL 40–49 | 31,927 | +0.01% | −0.07% | −0.45% | (short) | 14.9% | 34.8% |
| SELL 50–59 | 1,323 | −0.34% | −0.73% | −1.15% | (short) | 13.0% | 36.1% |

**Findings:**
- **Threshold 70 almost never fires** (34 times in 10 years across 475 stocks). That is why the strong-signal alert feed stayed empty.
- **A higher score is not more accurate.** BUY 60–69 earns no more over 10 days than 50–59 or 40–49: about +0.3% above the average stock-day, before charges. Lowering the threshold to 60 would add alerts, not accuracy.
- **No intraday edge.** Next-day intraday returns after charges are negative in every band.
- **The scanner's levels lose to its stops.** The +3 ATR target is reached first less often than the −2 ATR stop.
- **SELL scores behave in reverse.** Stocks with SELL 50–59 rose 1.15% over the next 10 days, more than average: oversold stocks bounced.
- **Limits.** These are daily-close approximations of an intraday score (the live scan uses intraday prices and partial-day volume). The universe is today's NIFTY 500, which brings survivorship bias.

## What the app does with this

- **Live first sightings.** The server scanner records, every minute in market hours, the first time each stock reaches score 50 in a session. It stores the time, price, score, reasons, levels and blocking guards in `discovery_observations` (migration `20261022_discovery_observations.sql`). The maximum score, last sighting and count update later; the first-seen fields never change.
- **Outcome tracking.** Every 30 minutes, outcomes are measured from the first-seen price: same-day close, 1, 5 and 10 sessions, and target or stop first.
- **Where it appears:**
  - Discover and Watch ideas show the server's first-signal time, price and score.
  - Alerts lists today's **watch alerts** (score 60+) with first-seen times.
  - **Score accuracy** (on Discover and Alerts) shows the live forward results next to this study.
- **Thresholds.** The paper-entry gate stays at 70. Live accuracy by band should decide any change, not this study alone.
