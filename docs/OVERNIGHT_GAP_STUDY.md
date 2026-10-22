# Can a gap or an intraday move be anticipated before it happens?

Studied on 22 Oct 2026 to decide what the aggressive paper book trades. Scripts: `research/overnightGapStudy.mjs`
(10 years of Yahoo daily bars, NIFTY 50, 116,014 stock-days) and `research/intradayLevelStudy.mjs` (2 years of
Yahoo hourly bars). Costs use the published broker tariff (`shared/brokerCharges.js`) plus 5 bps slippage per
side: 0.384% round trip for ₹25,000 of delivery shares, 0.206% for ₹25,000 intraday (MIS), 0.166% for a ₹5 lakh
stock-futures position. "Halves" splits the sample at 2021.

## Overnight: buy at today's close, sell at tomorrow's open

| Today's condition | Stock-days | Avg gap | Gap up | Net, delivery | Net, futures | Halves (gap) |
|---|---|---|---|---|---|---|
| Any day | 116,014 | +0.134% | 60.6% | −0.249% | −0.032% | 0.149 / 0.125 |
| Close in top 10% of the day's range | 5,955 | +0.117% | 57.4% | −0.267% | −0.049% | 0.039 / 0.148 |
| Top 10% + new 20-day high + 1.5× volume | 740 | +0.244% | 59.3% | −0.140% | +0.078% | 0.160 / 0.285 |
| **Top 10% + new 20-day high + 2× volume + NIFTY up** | 347 | +0.319% | 57.9% | −0.065% | **+0.153%** | 0.231 / 0.364 |
| **Up >3% on 2× volume** | 2,186 | +0.323% | 63.4% | −0.061% | **+0.157%** | 0.188 / 0.431 |
| Close in bottom 10% (for a gap down) | 6,024 | +0.147% | 63.4% | — | — | 0.201 / 0.122 |

Findings:
- A strong close does predict a larger gap up the next morning, consistently in both halves of the decade.
- The gap is small. Delivery charges (STT on both sides, DP charge) exceed it for every filter, so buying shares
  today to sell tomorrow loses after costs. Stock futures are cheap enough that the two strongest filters keep
  about +0.15% per trade.
- A weak close does not predict a gap down (stocks still gapped up 63% of the time), so there is no short side.
- These are averages over many trades; individual gaps vary widely, and the entry here is the closing price
  while the book enters between 15:15 and 15:25.

The aggressive book trades the two bold rows as "Overnight gap" (policy `aggressive-v2`).

## Intraday: entries at levels known before the session

Stop entry at the level, 1% stop, 2% target, exit at the last hourly bar (15:15).

| Setup | Trades | Gross avg | Win | Net, MIS | Halves (gross) |
|---|---|---|---|---|---|
| Break of the previous day's high (long) | 17,106 | −0.140% | 37.5% | −0.347% | −0.150 / −0.123 |
| Break of the previous day's low (short) | 16,700 | −0.133% | 39.4% | −0.339% | −0.168 / −0.077 |
| NR7 day, break of the previous high | 3,178 | −0.084% | 40.5% | −0.290% | −0.088 / −0.076 |
| Gap up 0.5–3%, break of the previous high | 4,247 | +0.002% | 42.5% | −0.204% | 0.002 / 0.003 |
| Gap up 0.5–3%, break of the first hour's high | 3,190 | −0.033% | 44.7% | −0.239% | −0.008 / −0.078 |
| Gap down 0.5–3%, buy the open for a fill | 4,283 | +0.005% | 51.8% | −0.201% | 0.067 / −0.063 |

Findings: on NIFTY 50 stocks, price-level breakouts lose money even before charges; large-cap breakouts tend to
reverse. Together with the failed validations of the 15-minute rules, price alone does not anticipate intraday
moves here. Gap-and-go was therefore removed from the aggressive book. Hourly bars cannot order a stop and a
target inside one bar (the stop is assumed first), and two years is a short sample.

## What could anticipate intraday moves (not yet tested)

Information that exists before the move rather than in the price: the NSE pre-open order imbalance (09:00–09:08),
scheduled results and board meetings, overnight filings and bulk deals, F&O open-interest build-up, sector and
index futures moves. Each needs its own study before it can trade.
