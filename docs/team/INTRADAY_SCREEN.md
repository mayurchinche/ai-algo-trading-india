# Intraday screen on Upstox 1-minute bars (dev window 2022-01..2024-06, 37 liquid stocks cached so far)

Causal: decide on bar m, fill at open of m+1, ±5 bps slippage, MIS cost tariff, ₹1,000 risk/trade, ≤₹50k position, ≤3 trades/day, −1.5% day / −4% month stops, flat 15:15. Parameters fixed before the run; 5 variants (added to the count). Holdout untouched.

| Strategy | Net avg %/mo | Worst | Max DD | Positive months | t | Gross avg %/mo (no costs) |
|---|---|---|---|---|---|---|
| orb30 (30-min range break, long, above SMA20) | −2.91 | −4.6 | −84% | 3% | −11.7 | +0.07 |
| orbShort | −2.28 | −4.8 | −67% | 21% | −6.6 | +0.58 |
| vwapRev (long, 1.5% below VWAP) | −1.10 | −4.3 | −33% | 24% | −4.2 | −0.02 |
| gapDown (2–6% gap-down fill, above SMA200-proxy SMA20) | −0.15 | −1.7 | −5% | 29% | −0.7 | +0.11 |
| pmMom (12:30 afternoon momentum) | −0.16 | −0.7 | −4.7% | 30% | −2.4 | +0.17 |

Reading: gross edge is about zero; round-trip costs on ₹50k MIS trades (~₹70 + 10 bps slippage) are ~0.25% per trade, so 50 trades/month costs ~3%/month. Simple price-only intraday triggers do not beat costs. Next filters must raise gross edge per trade well above 0.3%: news/bulk-deal catalysts, sector-relative strength, volume surge, fewer and larger trades. Option leverage is only worth testing once the underlying trigger has gross edge.
