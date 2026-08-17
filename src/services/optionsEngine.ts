// ponytail: Options trading engine — mimics how top 1% traders pick options
// Computes IV proxy, strike selection, strategy selection, P&L scenarios

import type { DiscoveredStock } from './stockDiscovery';

export interface OptionsPick {
  stock: DiscoveredStock;
  strategy: OptionsStrategy;
  ivPercentile: number;  // Historical vol percentile (proxy)
  expectedMoveWeekly: number;  // 1-week expected move %
  expectedMoveMonthly: number; // 1-month expected move %
  // Legs
  legs: OptionLeg[];
  // P&L
  maxProfit: number;
  maxLoss: number;
  breakeven: number[];
  probabilityOfProfit: number;  // estimated from expected move
  riskReward: number;
  // Execution
  suggestedExpiry: string;
  tradeRationale: string[];
  riskWarnings: string[];
  // Edge — why this trade has an edge
  edgeFactors: string[];
}

export interface OptionLeg {
  type: 'CE' | 'PE';
  action: 'BUY' | 'SELL';
  strike: number;
  premium: number;  // estimated
  lots: number;
}

export type OptionsStrategy =
  | 'Bull Call Spread'
  | 'Bear Put Spread'
  | 'Iron Condor'
  | 'Short Strangle'
  | 'Long Straddle'
  | 'Covered Call'
  | 'Protective Put'
  | 'Bull Put Spread (Credit)'
  | 'Calendar Spread'
  | 'Naked Call (Sell)'
  | 'Naked Put (Sell)'
  | 'Ratio Call Spread';

// Top 1% trader rules:
// 1. Sell premium when IV is high (>70 percentile) → Iron Condor, Short Strangle
// 2. Buy directional when conviction is high + IV is low → Debit Spreads
// 3. Never risk more than 2% of capital per trade
// 4. Use spreads to define risk — naked only on indices
// 5. Weekly expiry for high-conviction directional, monthly for premium selling
// 6. Strike selection: sell at expected move boundary, buy ATM/slightly OTM

function computeHistoricalVolatility(atrPct: number): number {
  // ATR% annualized → IV proxy
  // Daily ATR% * sqrt(252) gives annualized vol
  return atrPct * Math.sqrt(252);
}

function ivPercentile(annualizedVol: number): number {
  // Typical NSE stock vol ranges: 15% (low) to 60% (high)
  // Map to percentile
  if (annualizedVol < 20) return 10;
  if (annualizedVol < 30) return 30;
  if (annualizedVol < 40) return 50;
  if (annualizedVol < 50) return 70;
  if (annualizedVol < 60) return 85;
  return 95;
}

function roundToStrike(price: number): number {
  // NSE strike intervals: <500=5, 500-2000=10, 2000+=50
  if (price < 500) return Math.round(price / 5) * 5;
  if (price < 2000) return Math.round(price / 10) * 10;
  return Math.round(price / 50) * 50;
}

function estimatePremium(ltp: number, strike: number, type: 'CE' | 'PE', atrPct: number, daysToExpiry: number): number {
  // Black-Scholes-lite estimation
  const intrinsic = type === 'CE' ? Math.max(ltp - strike, 0) : Math.max(strike - ltp, 0);
  const timeValue = ltp * atrPct * Math.sqrt(daysToExpiry / 365) * 0.4;
  return Math.round((intrinsic + timeValue) * 100) / 100;
}

function selectStrategy(stock: DiscoveredStock, ivPct: number): {
  strategy: OptionsStrategy;
  rationale: string[];
  edge: string[];
} {
  const { scores, rsi, trend, volumeRatio } = stock;
  const bullish = scores.momentum > 30 || scores.breakout > 40;
  const bearish = scores.momentum < -30;
  const rangebound = Math.abs(scores.trendFollowing) < 20 && Math.abs(scores.momentum) < 25;
  const highConviction = Math.abs(stock.overallScore) > 50;

  // RULE 1: High IV + range-bound → SELL PREMIUM (top 1% bread & butter)
  if (ivPct > 70 && rangebound) {
    return {
      strategy: 'Iron Condor',
      rationale: [
        `IV at ${ivPct}th percentile — premium is expensive, sell it`,
        'Range-bound price action — low probability of large move',
        'Top 1% strategy: sell overpriced volatility and let theta work',
        `RSI at ${rsi.toFixed(0)} — neither overbought nor oversold`,
      ],
      edge: [
        'Selling high IV = statistical edge (IV usually overstates actual move)',
        'Theta decay accelerates in last 2 weeks before expiry',
        'Defined risk on both sides — no unlimited loss',
      ],
    };
  }

  // RULE 2: High IV + bullish → Bull Put Spread (credit)
  if (ivPct > 60 && bullish) {
    return {
      strategy: 'Bull Put Spread (Credit)',
      rationale: [
        `Bullish setup (momentum: ${scores.momentum}) with elevated IV (${ivPct}th pct)`,
        'Sell high premium put spread — get paid to be bullish',
        'If stock stays above short put strike, keep entire premium',
        `Volume ratio ${volumeRatio}x — smart money confirming direction`,
      ],
      edge: [
        'Selling against the trend = high probability win',
        'Premium is inflated due to high IV — overpriced protection',
        'Time works in your favor (positive theta)',
      ],
    };
  }

  // RULE 3: Low IV + high conviction bullish → Bull Call Spread
  if (ivPct < 40 && bullish && highConviction) {
    return {
      strategy: 'Bull Call Spread',
      rationale: [
        `Strong bullish conviction (score: ${stock.overallScore}) with cheap IV`,
        'Options are inexpensive — good time to buy directional',
        `Breakout score ${scores.breakout} — potential large move ahead`,
        `SMA alignment: ${trend.replace('_', ' ')} confirms uptrend`,
      ],
      edge: [
        'Buying low IV = getting options cheap (below fair value)',
        'Spread reduces cost and defines risk',
        'Breakout + volume = momentum continuation expected',
      ],
    };
  }

  // RULE 4: High IV + bearish → Bear Put Spread or Naked Call Sell
  if (ivPct > 60 && bearish) {
    return {
      strategy: 'Bear Put Spread',
      rationale: [
        `Bearish momentum (score: ${scores.momentum}) — downside expected`,
        `IV elevated (${ivPct}th pct) but direction clear — debit spread`,
        `RSI: ${rsi.toFixed(0)} — still has room to fall`,
        'Below SMA50 and SMA200 — path of least resistance is down',
      ],
      edge: [
        'Trend confirmation + momentum = high probability trade',
        'Defined risk even if stock reverses',
        'Put spread cheaper than naked put in high IV',
      ],
    };
  }

  // RULE 5: Pre-breakout + low IV → Long Straddle
  if (ivPct < 35 && scores.breakout > 50 && volumeRatio > 2) {
    return {
      strategy: 'Long Straddle',
      rationale: [
        'Breakout imminent — massive volume spike detected',
        `IV only at ${ivPct}th percentile — options are cheap for the expected move`,
        `Volume ${volumeRatio}x average — institutional activity`,
        'Direction unclear but big move expected — straddle profits either way',
      ],
      edge: [
        'Buying straddle when IV is low = cheap entry for a big move',
        'Volume spike historically precedes 2-3x ATR moves',
        'Win regardless of direction — only need magnitude',
      ],
    };
  }

  // RULE 6: High IV + overbought → Short Strangle (experienced traders only)
  if (ivPct > 75 && rsi > 65 && rangebound) {
    return {
      strategy: 'Short Strangle',
      rationale: [
        `Extremely high IV (${ivPct}th pct) — premiums are fat`,
        'Market pricing in a larger move than likely to occur',
        'Sell both call and put beyond expected move range',
        'Top 1% income strategy — 70-80% probability of profit',
      ],
      edge: [
        'Statistically, market moves less than implied by options pricing ~70% of time',
        'Theta decay highest in last 7-10 days',
        'Wide strikes = high probability but lower per-trade return',
      ],
    };
  }

  // RULE 7: Bullish with moderate conviction → Ratio Call Spread
  if (bullish && !highConviction && ivPct > 40) {
    return {
      strategy: 'Ratio Call Spread',
      rationale: [
        'Moderately bullish — expect limited upside',
        `Score ${stock.overallScore} — not strong enough for outright call`,
        'Buy 1 ATM call, sell 2 OTM calls → reduced cost or credit',
        'Profit zone between ATM and OTM strikes',
      ],
      edge: [
        'Free or credit entry — wins even if stock stays flat',
        'Selling extra call leverages theta in your favor',
        'Works when IV skew makes OTM calls expensive',
      ],
    };
  }

  // DEFAULT: Calendar Spread for neutral-slight directional
  return {
    strategy: 'Calendar Spread',
    rationale: [
      'No extreme signal — use time decay difference between expiries',
      'Sell near-month, buy far-month same strike — theta edge',
      `Current IV: ${ivPct}th percentile — moderate environment`,
      'Profits from IV expansion or time decay differential',
    ],
    edge: [
      'Near-month decays faster than far-month = structural edge',
      'Low risk, low reward — consistent small gains',
      'Can adjust to directional if stock moves',
    ],
  };
}

export function generateOptionsPicks(stocks: DiscoveredStock[]): OptionsPick[] {
  return stocks
    .filter(s => s.ltp > 50 && Math.abs(s.overallScore) > 15) // Only trade stocks > ₹50 with some conviction
    .map(stock => {
      const atrPct = stock.foAnalysis.expectedMove;
      const annualVol = computeHistoricalVolatility(atrPct);
      const ivPct = ivPercentile(annualVol);
      const weeklyMove = atrPct * Math.sqrt(5); // 5 trading days
      const monthlyMove = atrPct * Math.sqrt(22); // ~22 trading days

      const { strategy, rationale, edge } = selectStrategy(stock, ivPct);
      const ltp = stock.ltp;

      // Build legs based on strategy
      let legs: OptionLeg[] = [];
      let maxProfit = 0, maxLoss = 0;
      let breakeven: number[] = [];
      let pop = 0.5; // probability of profit
      let suggestedExpiry = 'Monthly';

      const atmStrike = roundToStrike(ltp);
      const otmCallStrike = roundToStrike(ltp * (1 + weeklyMove / 100));
      const otmPutStrike = roundToStrike(ltp * (1 - weeklyMove / 100));
      const farOtmCall = roundToStrike(ltp * (1 + monthlyMove / 100));
      const farOtmPut = roundToStrike(ltp * (1 - monthlyMove / 100));
      const daysToExpiry = strategy.includes('Calendar') ? 30 : strategy.includes('Iron') || strategy.includes('Strangle') ? 21 : 7;

      switch (strategy) {
        case 'Iron Condor': {
          const sellCallP = estimatePremium(ltp, otmCallStrike, 'CE', atrPct / 100, daysToExpiry);
          const buyCallP = estimatePremium(ltp, farOtmCall, 'CE', atrPct / 100, daysToExpiry);
          const sellPutP = estimatePremium(ltp, otmPutStrike, 'PE', atrPct / 100, daysToExpiry);
          const buyPutP = estimatePremium(ltp, farOtmPut, 'PE', atrPct / 100, daysToExpiry);
          legs = [
            { type: 'CE', action: 'SELL', strike: otmCallStrike, premium: sellCallP, lots: 1 },
            { type: 'CE', action: 'BUY', strike: farOtmCall, premium: buyCallP, lots: 1 },
            { type: 'PE', action: 'SELL', strike: otmPutStrike, premium: sellPutP, lots: 1 },
            { type: 'PE', action: 'BUY', strike: farOtmPut, premium: buyPutP, lots: 1 },
          ];
          const netCredit = (sellCallP - buyCallP) + (sellPutP - buyPutP);
          maxProfit = Math.round(netCredit * 100) / 100;
          const width = Math.min(farOtmCall - otmCallStrike, otmPutStrike - farOtmPut);
          maxLoss = Math.round((width - netCredit) * 100) / 100;
          breakeven = [otmPutStrike - netCredit, otmCallStrike + netCredit];
          pop = 0.68;
          suggestedExpiry = 'Monthly (21-30 DTE)';
          break;
        }
        case 'Bull Call Spread': {
          const buyP = estimatePremium(ltp, atmStrike, 'CE', atrPct / 100, daysToExpiry);
          const sellP = estimatePremium(ltp, otmCallStrike, 'CE', atrPct / 100, daysToExpiry);
          legs = [
            { type: 'CE', action: 'BUY', strike: atmStrike, premium: buyP, lots: 1 },
            { type: 'CE', action: 'SELL', strike: otmCallStrike, premium: sellP, lots: 1 },
          ];
          const netDebit = buyP - sellP;
          maxProfit = Math.round(((otmCallStrike - atmStrike) - netDebit) * 100) / 100;
          maxLoss = Math.round(netDebit * 100) / 100;
          breakeven = [atmStrike + netDebit];
          pop = 0.45;
          suggestedExpiry = 'Weekly (5-7 DTE)';
          break;
        }
        case 'Bear Put Spread': {
          const buyP = estimatePremium(ltp, atmStrike, 'PE', atrPct / 100, daysToExpiry);
          const sellP = estimatePremium(ltp, otmPutStrike, 'PE', atrPct / 100, daysToExpiry);
          legs = [
            { type: 'PE', action: 'BUY', strike: atmStrike, premium: buyP, lots: 1 },
            { type: 'PE', action: 'SELL', strike: otmPutStrike, premium: sellP, lots: 1 },
          ];
          const netDebit = buyP - sellP;
          maxProfit = Math.round(((atmStrike - otmPutStrike) - netDebit) * 100) / 100;
          maxLoss = Math.round(netDebit * 100) / 100;
          breakeven = [atmStrike - netDebit];
          pop = 0.45;
          suggestedExpiry = 'Weekly (5-7 DTE)';
          break;
        }
        case 'Bull Put Spread (Credit)': {
          const sellP = estimatePremium(ltp, otmPutStrike, 'PE', atrPct / 100, daysToExpiry);
          const buyP = estimatePremium(ltp, farOtmPut, 'PE', atrPct / 100, daysToExpiry);
          legs = [
            { type: 'PE', action: 'SELL', strike: otmPutStrike, premium: sellP, lots: 1 },
            { type: 'PE', action: 'BUY', strike: farOtmPut, premium: buyP, lots: 1 },
          ];
          const netCredit = sellP - buyP;
          maxProfit = Math.round(netCredit * 100) / 100;
          maxLoss = Math.round(((otmPutStrike - farOtmPut) - netCredit) * 100) / 100;
          breakeven = [otmPutStrike - netCredit];
          pop = 0.65;
          suggestedExpiry = 'Monthly (14-21 DTE)';
          break;
        }
        case 'Short Strangle': {
          const sellCallP = estimatePremium(ltp, farOtmCall, 'CE', atrPct / 100, daysToExpiry);
          const sellPutP = estimatePremium(ltp, farOtmPut, 'PE', atrPct / 100, daysToExpiry);
          legs = [
            { type: 'CE', action: 'SELL', strike: farOtmCall, premium: sellCallP, lots: 1 },
            { type: 'PE', action: 'SELL', strike: farOtmPut, premium: sellPutP, lots: 1 },
          ];
          const netCredit = sellCallP + sellPutP;
          maxProfit = Math.round(netCredit * 100) / 100;
          maxLoss = -1; // unlimited
          breakeven = [farOtmPut - netCredit, farOtmCall + netCredit];
          pop = 0.72;
          suggestedExpiry = 'Monthly (21-30 DTE)';
          break;
        }
        case 'Long Straddle': {
          const buyCallP = estimatePremium(ltp, atmStrike, 'CE', atrPct / 100, daysToExpiry);
          const buyPutP = estimatePremium(ltp, atmStrike, 'PE', atrPct / 100, daysToExpiry);
          legs = [
            { type: 'CE', action: 'BUY', strike: atmStrike, premium: buyCallP, lots: 1 },
            { type: 'PE', action: 'BUY', strike: atmStrike, premium: buyPutP, lots: 1 },
          ];
          const totalDebit = buyCallP + buyPutP;
          maxProfit = -1; // unlimited
          maxLoss = Math.round(totalDebit * 100) / 100;
          breakeven = [atmStrike - totalDebit, atmStrike + totalDebit];
          pop = 0.35;
          suggestedExpiry = 'Weekly (event-based)';
          break;
        }
        default: {
          // Calendar / Ratio — simplified
          const buyP = estimatePremium(ltp, atmStrike, 'CE', atrPct / 100, 30);
          const sellP = estimatePremium(ltp, atmStrike, 'CE', atrPct / 100, 7);
          legs = [
            { type: 'CE', action: 'SELL', strike: atmStrike, premium: sellP, lots: 1 },
            { type: 'CE', action: 'BUY', strike: atmStrike, premium: buyP, lots: 1 },
          ];
          maxProfit = Math.round(sellP * 2 * 100) / 100;
          maxLoss = Math.round((buyP - sellP) * 100) / 100;
          breakeven = [atmStrike];
          pop = 0.55;
          suggestedExpiry = 'Sell Weekly, Buy Monthly';
        }
      }

      const riskReward = maxLoss > 0 ? Math.round((maxProfit / maxLoss) * 10) / 10 : maxProfit > 0 ? 99 : 0;

      const riskWarnings: string[] = [];
      if (maxLoss === -1) riskWarnings.push('⚠️ Unlimited loss potential — use strict stop loss');
      if (pop < 0.4) riskWarnings.push('⚠️ Low probability of profit — need large move to win');
      if (ivPct > 80) riskWarnings.push('⚠️ Very high IV — premiums expensive, potential IV crush after event');
      if (stock.volumeRatio < 0.5) riskWarnings.push('⚠️ Low volume — may face liquidity issues in options');

      return {
        stock,
        strategy,
        ivPercentile: ivPct,
        expectedMoveWeekly: Math.round(weeklyMove * 100) / 100,
        expectedMoveMonthly: Math.round(monthlyMove * 100) / 100,
        legs,
        maxProfit,
        maxLoss,
        breakeven,
        probabilityOfProfit: pop,
        riskReward,
        suggestedExpiry,
        tradeRationale: rationale,
        riskWarnings,
        edgeFactors: edge,
      };
    })
    .sort((a, b) => {
      // Sort: high PoP + good R:R first
      const scoreA = a.probabilityOfProfit * 50 + Math.min(a.riskReward, 5) * 10;
      const scoreB = b.probabilityOfProfit * 50 + Math.min(b.riskReward, 5) * 10;
      return scoreB - scoreA;
    });
}
