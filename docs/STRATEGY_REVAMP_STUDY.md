# Strategy revamp study — why the live books lose and what the evidence supports

Date: 25 Oct 2026. Data: NSE bhavcopy 2016–2026 (2,450 liquid-enough companies incl. 603 delisted), NSE F&O bhavcopy for NIFTY
options 2016–2026, Zerodha charges, ₹2 lakh account. Code: `research/` (never feeds the app). Every result is after costs.
Variants tried in this whole research programme: about 33 (every one is listed in the tables below or in the planning notes).

## 1. Why the books show about −₹70,000

Pulled from production on 24 Oct (16 open signal paper runs, marked at Friday's close):

| Rule | Open P&L | Note |
|---|---:|---|
| Futures 20-day breakout (5 runs) | −₹39,646 | one lot = ₹4.7–10.9 lakh notional |
| 20-day breakout, shares (9 runs, 1 stopped) | −₹19,255 | INFY gapped through its stop: −₹7,729 |
| Futures 200-day trend (2 runs) | −₹15,813 | TECHM lot ₹10.9 lakh |
| Technical rating, 200-day trend | −₹2,966 | |
| **Total** | **−₹77,680** | |

Causes, in order of size:
1. **Futures lots are far too big.** Seven futures runs hold ₹4–11 lakh each; they produced 71% of the loss. A ₹2 lakh account cannot carry one lot at a 1–3% stop. (Capped on 23 Oct: they exit at Monday's open.)
2. **One idea counted four times.** IT stocks (TECHM, INFY, HCLTECH, TCS) were entered by several rules at once; one sector move on Friday hit everything together. (Caps: one position per stock, ≤2 per sector, from 23 Oct.)
3. **Gap risk.** INFY opened 8% below its stop; a stop is not a limit on loss for overnight holds.
4. **A single day is noise** — but the dominant cause below (section 2) says the rules had no real edge to offset it.

## 2. The root cause: our validation used survivors

The app validates a rule on today's NIFTY 50 / F&O stocks. Those are the companies that survived and grew, so any "buy strength" rule looks
good by construction. We re-ran the same rules, same ₹2 L simulator, on (a) the full point-in-time market including stocks that later fell
out or were delisted, and (b) only today's 100 most liquid survivors (how our validation sees history).

| Rule (the app's validated rules) | Survivors only: avg/mo, avg trade | Full market: avg/mo, avg trade | Full market OOS 2022–26 |
|---|---|---|---|
| 20-day breakout | **+0.84%, +2.48%** | −0.23%, −0.61% | −0.55%/mo, DD −37.8% |
| Gap-up continuation | +0.40%, +1.60% | −0.18%, −0.47% | −0.05%/mo, DD −23.1% |
| 200-day trend | +0.31%, +2.75% | +0.16%, +0.71% | +0.24%/mo, DD −9.8% |
| 52-week-high swing (new, George–Hwang) | not run | +0.37%, +1.90% | 0.00%/mo |

Survivorship alone explains the gap between "validated" and "losing live". The app's per-trade backtest numbers (+0.9 to +2.3%) are not
achievable going forward. 200-day trend is the only one that stays positive, at about a quarter of a percent a month.

## 3. The Megacellar "WilliamsRReactive 6,292%" claim

Reverse-engineered from the site's own files (`data/descriptions.json`, per-timeframe `plot_data`):
- The rule is a **ranker**: predicted price = close × (1 − %R/100), i.e. buy the most oversold of 10 stocks; code is behind a Google Drive link.
- The 6,292.85% is the `7_weekly` setting. The *same* strategy on its other settings ends at 9.5x (30_monthly, equal to the benchmark), 42x, 62x, 64x, 72x, 77x —
  eight parameter sets published, the best shown. 62.9x over 25 years is **18.6% a year ≈ 1.45% a month before any cost**, on 10 US defensive stocks
  (KO, PG, JNJ …) 2000–2024, with no out-of-sample period, costs or drawdown.
- Our replication on NSE (`research/megacellarWilliams.mjs`; N=14, weekly, top 5 of the 50 most liquid, fixed in advance):

| Variant | CAGR | Worst month | Max DD | Benchmark CAGR |
|---|---:|---:|---:|---:|
| Most oversold, gross (site style) | −0.7% | −35% | −70% | +10.0% |
| Most oversold, net of Indian delivery charges | −19.5% | −36% | −90% | +10.0% |
| Control (least oversold), net | −24.3% | −33% | −94% | +10.0% |

It does not replicate: gross it is flat against a +10% benchmark, and weekly delivery turnover costs about 1.4% a month.

## 4. What the books say, tested (verdicts on Indian data, after costs)

Catalogue compiled from published sources (Connors/Alvarez, Williams, Crabel, Raschke, Turtle, O'Neil/Minervini, Jegadeesh–Titman, George–Hwang,
low-volatility, short-term reversal, PEAD, calendar effects, SEBI loss studies). Tested so far:

| Family | Result | Verdict |
|---|---|---|
| RSI(2), IBS, RSI14<30, Double-7s (mean reversion) | OOS −0.1% to −1.2%/mo | reject: delivery costs ≈ the whole edge |
| 20-day breakout, gap-up continuation (app rules) | negative on the full market | reject as is |
| 52-week-high swing | +0.37%/mo, OOS 0.00% | reject |
| 200-day trend (app rule) | +0.16%/mo, DD −9.9% | keep as a small sleeve |
| 12-1 momentum, top 10 of 100, monthly | +1.7%/mo net, **worst month −29%, DD −35%** | beats the market (17.4% vs 12.0% CAGR) but breaks the 10% DD limit |
| Williams %R "reactive" (Megacellar) | negative net | reject |
| **Gap-down fill, intraday (MIS), buy the auction open** | **+1.9%/mo OOS**, 66% positive months, worst −5.1%, DD −14.7% | only edge found; dies with ≥10 bps worse fill → live paper test built |
| NIFTY monthly iron condor (EOD settlement data) | 72% wins but −₹782/trade, DD −56% | reject |
| NIFTY weekly iron condor / put spreads | −₹650 to −₹1,765/trade | reject (8 orders of costs per cycle) |
| NIFTY monthly put credit spread | 82% wins, ≈ −₹44/trade | break-even before tail risk |

Options caveat: end-of-day settlement prices only (intraday stop paths are not modelled), lot size assumed 65. Not a final answer, but it agrees with SEBI's
studies that retail option sellers lose; a credit-spread edge would have to come from timing, not from the structure.

## 5. Where this leaves the "2% a month" goal

- Nothing tested meets all of: worst month ≥ −4%, max drawdown ≤ 10%, ≥70% positive months, positive in both halves. 2% every month is not supported by any evidence.
- Closest candidates: gap-down fill (average OK, drawdown −14.7% and execution-fragile), momentum (returns OK, drawdown −35%), 200-day trend (safe but ≈0.2%/mo).
- Loosening the limits to fit a result would be curve-fitting the gate; we have not done that.

## 6. What we changed / propose

Done (earlier commits): one position per stock, ≤2 per sector, no futures in the validated book; the gap-down fill live test book (auction vs live fill) from 26 Oct.
Proposed, needs your approval because it changes the live books materially:
1. Re-validate the rule library on the survivorship-free universe (point-in-time liquidity filter) before any rule can auto-paper; today's rule gate is optimistic.
2. Stop auto-paper on 20-day breakout and gap-up continuation (negative on the full market). Keep 200-day trend (shares only, ≤₹50k per position).
3. Judge the gap-down fill by the live comparison (auction vs 09:16 fill) for 2–3 months before trusting it.
4. For options and intraday timing we still need 1-minute and intraday option history (Upstox token); the daily data cannot test stop paths.
