import type { DiscoveredStock, StrategyScores, FOAnalysis } from './stockDiscovery';
import { freshQuote, istDate, validLevels } from './tradingTime';
import { atr, bollinger, macd, rsi, sma } from '../../shared/indicators';

// --- Technical Analysis Computations ---
// Legacy scanner variants (Cutler RSI, simple-mean ATR, first-value-seeded EMA) are kept explicit so
// historical signals and stored evidence stay reproducible. Callers guarantee 200+ finite bars.

const last = (series: number[]) => series[series.length - 1];

function legacyIndicators(closes: number[], highs: number[], lows: number[]) {
  const macdLines = macd(closes, { seed: 'first' });
  const bands = bollinger(closes, 20, 2);
  const percentB = last(bands.percentB);
  return {
    rsi: last(rsi(closes, 14, { method: 'simple' })),
    macd: { value: last(macdLines.macd), signal: last(macdLines.signal), histogram: last(macdLines.histogram) },
    sma20: last(sma(closes, 20)),
    sma50: last(sma(closes, 50)),
    sma200: last(sma(closes, 200)),
    atr: last(atr(highs, lows, closes, 14, { method: 'simple' })),
    // 0 = at lower band, 1 = at upper band; collapsed bands are treated as mid-band.
    bollingerPos: Number.isNaN(percentB) ? 0.5 : percentB,
  };
}

// --- Strategy Scoring ---

export function scoreStrategies(
  ltp: number, rsi: number, macd: { value: number; signal: number; histogram: number },
  sma20: number, sma50: number, sma200: number,
  volumeRatio: number, bollingerPos: number,
  weekHigh52: number, weekLow52: number, _atr: number
): StrategyScores {
  // Momentum: RSI trend + MACD + price above SMAs
  const rsiMomentum = rsi > 50 ? Math.min((rsi - 50) / 30 * 100, 100) : Math.max((rsi - 50) / 30 * 100, -100);
  const macdMomentum = macd.histogram > 0 ? Math.min(macd.histogram / (ltp * 0.01) * 50, 100) : Math.max(macd.histogram / (ltp * 0.01) * 50, -100);
  const priceMomentum = ((ltp > sma20 ? 30 : -30) + (ltp > sma50 ? 30 : -30) + (ltp > sma200 ? 40 : -40));
  const momentum = Math.round((rsiMomentum * 0.3 + macdMomentum * 0.3 + priceMomentum * 0.4));

  // Mean Reversion: oversold = buy opportunity
  let meanReversion = 0;
  if (rsi < 30) meanReversion = 80 + (30 - rsi) * 2;
  else if (rsi > 70) meanReversion = -(80 + (rsi - 70) * 2);
  else if (bollingerPos < 0.2) meanReversion = 60;
  else if (bollingerPos > 0.8) meanReversion = -60;
  meanReversion = Math.max(-100, Math.min(100, Math.round(meanReversion)));

  // Breakout: near 52w high + volume spike
  const distFromHigh = (weekHigh52 - ltp) / weekHigh52;
  const distFromLow = (ltp - weekLow52) / weekLow52;
  let breakout = 0;
  if (distFromHigh < 0.05 && volumeRatio > 1.5) breakout = 80 + Math.min(volumeRatio * 10, 20);
  else if (distFromHigh < 0.10 && volumeRatio > 1.2) breakout = 50;
  else if (distFromLow < 0.10) breakout = -60;
  breakout = Math.max(-100, Math.min(100, Math.round(breakout)));

  // Trend Following: SMA alignment (20>50>200 = strong uptrend)
  let trendFollowing = 0;
  if (sma20 > sma50 && sma50 > sma200) trendFollowing = 80;
  else if (sma20 > sma50) trendFollowing = 40;
  else if (sma20 < sma50 && sma50 < sma200) trendFollowing = -80;
  else if (sma20 < sma50) trendFollowing = -40;
  // ATR measures volatility, not ADX or directional trend strength.
  // Keep ATR for risk levels; do not inflate this score for larger ranges.
  trendFollowing = Math.max(-100, Math.min(100, trendFollowing));

  // Volume pattern: price and volume alone do not establish institutional activity
  let smartMoney = 0;
  if (volumeRatio > 2) smartMoney += ltp > sma50 ? 40 : -40;
  if (volumeRatio > 3) smartMoney += ltp > sma50 ? 30 : -30;
  if (ltp > sma200 && volumeRatio > 1.5) smartMoney += 20;
  if (distFromHigh < 0.03 && volumeRatio > 2) smartMoney += 10; // Breakout accumulation
  smartMoney = Math.max(-100, Math.min(100, Math.round(smartMoney)));

  return { momentum, meanReversion, breakout, trendFollowing, smartMoney };
}

function computeOverallSignal(scores: StrategyScores): { score: number; signal: DiscoveredStock['signal'] } {
  // Weighted average — momentum and trend following weighted higher
  const score = Math.round(
    scores.momentum * 0.25 +
    scores.meanReversion * 0.15 +
    scores.breakout * 0.25 +
    scores.trendFollowing * 0.20 +
    scores.smartMoney * 0.15
  );
  let signal: DiscoveredStock['signal'] = 'HOLD';
  if (score >= 70) signal = 'STRONG_BUY';
  else if (score >= 30) signal = 'BUY';
  else if (score <= -70) signal = 'STRONG_SELL';
  else if (score <= -30) signal = 'SELL';
  return { score, signal };
}

function computeFOAnalysis(ltp: number, atr: number, _sma20: number, scores: StrategyScores, _rsi: number): FOAnalysis {
  const expectedMove = (atr / ltp) * 100;
  const supportLevel = Math.round((ltp - atr * 1.5) * 100) / 100;
  const resistanceLevel = Math.round((ltp + atr * 1.5) * 100) / 100;
  const direction = computeOverallSignal(scores).score >= 0 ? 1 : -1;
  const suggestedStopLoss = Math.round((ltp - direction * atr * 2) * 100) / 100;
  const suggestedTarget = Math.round((ltp + direction * atr * 3) * 100) / 100;
  const riskReward = Math.round(((suggestedTarget - ltp) / (ltp - suggestedStopLoss)) * 10) / 10;

  const optionStrategy = '';
  const optionReason = 'Options unavailable without verified contract data';

  return { expectedMove: Math.round(expectedMove * 100) / 100, supportLevel, resistanceLevel, riskReward, suggestedStopLoss, suggestedTarget, optionStrategy, optionReason };
}

function generateReasons(scores: StrategyScores, rsi: number, volumeRatio: number, ltp: number, sma50: number, sma200: number, weekHigh52: number): string[] {
  const reasons: string[] = [];
  if (scores.momentum > 50) reasons.push('Strong bullish momentum — RSI + MACD aligned');
  if (scores.momentum < -50) reasons.push('Bearish momentum — avoid or short');
  if (rsi < 30) reasons.push(`RSI oversold at ${rsi.toFixed(1)} — potential bounce candidate`);
  if (rsi > 70) reasons.push(`RSI overbought at ${rsi.toFixed(1)} — caution, potential reversal`);
  if (volumeRatio > 2) reasons.push(`Volume spike ${volumeRatio.toFixed(1)}x avg — unusual activity; institutional participation unverified`);
  if (ltp > sma50 && ltp > sma200) reasons.push('Price above SMA50 & SMA200 — uptrend confirmed');
  if (ltp < sma50 && ltp < sma200) reasons.push('Price below SMA50 & SMA200 — downtrend');
  if ((weekHigh52 - ltp) / weekHigh52 < 0.05) reasons.push('Near 52-week high — breakout territory');
  if (scores.breakout > 60) reasons.push('Breakout pattern — volume confirms new high attempt');
  if (scores.smartMoney > 50) reasons.push('High volume at key levels; accumulation is unverified');
  if (scores.trendFollowing > 60) reasons.push('All moving averages aligned bullish (20>50>200)');
  return reasons.length ? reasons : ['Neutral — no strong conviction from any strategy'];
}

function identifyStrategies(scores: StrategyScores): string[] {
  const strats: string[] = [];
  if (scores.momentum > 40) strats.push('Momentum');
  if (scores.meanReversion > 40) strats.push('Mean Reversion');
  if (scores.breakout > 40) strats.push('Breakout');
  if (scores.trendFollowing > 40) strats.push('Trend Following');
  if (scores.smartMoney > 40) strats.push('Volume Pattern');
  if (scores.momentum < -40) strats.push('Bearish Momentum');
  if (scores.meanReversion < -40) strats.push('Overbought Reversal');
  return strats.length ? strats : ['Wait & Watch'];
}

function determineTrend(sma20: number, sma50: number, sma200: number, ltp: number): DiscoveredStock['trend'] {
  if (ltp > sma20 && sma20 > sma50 && sma50 > sma200) return 'STRONG_UP';
  if (ltp > sma50) return 'UP';
  if (ltp < sma20 && sma20 < sma50 && sma50 < sma200) return 'STRONG_DOWN';
  if (ltp < sma50) return 'DOWN';
  return 'SIDEWAYS';
}

// --- Data Fetching ---

export interface DiscoveryHistory { dates: string[]; closes: number[]; highs: number[]; lows: number[]; volumes: number[]; meta: Record<string, any> }
// No network or wall clock: callers own data availability and supply observation time.
export function evaluateDiscoverySnapshot(symbol: string, hist: DiscoveryHistory, now: number): DiscoveredStock | null {
  if (!Number.isFinite(now) || hist.closes.length < 200) return null;
  const n = hist.closes.length;
  if ([hist.highs, hist.lows].some(series => series.length !== n) || [hist.closes, hist.highs, hist.lows].some(series => !series.every(Number.isFinite))) return null;
      const { closes, highs, lows } = hist;
      // Price and timestamp must originate from the same chart response.
      const q = hist.meta;
      if (!Number.isFinite(q?.regularMarketPrice) || q.regularMarketPrice <= 0 || !Number.isFinite(q.regularMarketTime) || !Number.isFinite(q.regularMarketVolume) || q.regularMarketVolume < 0) return null;
      const ltp = q.regularMarketPrice;
      const quoteDate = istDate(q.regularMarketTime * 1000);
      const priorCloses = closes.filter((_, i) => hist.dates[i] < quoteDate);
      const prevClose = priorCloses.at(-1);
      if (!prevClose) return null;
      const change = ltp - prevClose;
      const changePct = change / prevClose * 100;
      const yearStart = new Date(Date.parse(quoteDate) - 365 * 86400000).toISOString().slice(0, 10);
      const yearRows = hist.dates.map((date, i) => ({date, high: highs[i], low: lows[i]})).filter(row => row.date >= yearStart && row.date <= quoteDate);
      if ((!Number.isFinite(q.fiftyTwoWeekHigh) || !Number.isFinite(q.fiftyTwoWeekLow)) && (!yearRows.length || hist.dates[0] > yearStart)) return null;
      const weekHigh52 = Number.isFinite(q.fiftyTwoWeekHigh) && q.fiftyTwoWeekHigh > 0 ? q.fiftyTwoWeekHigh : Math.max(...yearRows.map(row => row.high));
      const weekLow52 = Number.isFinite(q.fiftyTwoWeekLow) && q.fiftyTwoWeekLow > 0 ? q.fiftyTwoWeekLow : Math.min(...yearRows.map(row => row.low));
      const { rsi, macd, sma20, sma50, sma200, atr, bollingerPos } = legacyIndicators(closes, highs, lows);
      const vol = q.regularMarketVolume || 0;
      const avgVol = (q.averageDailyVolume3Month || hist.volumes.slice(-60).reduce((a, b) => a + b, 0) / 60);
      const volumeRatio = avgVol > 0 ? vol / avgVol : 0;

      const scores = scoreStrategies(
        ltp, rsi, macd, sma20, sma50, sma200,
        volumeRatio, bollingerPos,
        weekHigh52, weekLow52, atr
      );

      const { score: overallScore, signal } = computeOverallSignal(scores);
      const reasons = generateReasons(scores, rsi, volumeRatio, ltp, sma50, sma200, weekHigh52);
      const strategies = identifyStrategies(scores);
      const trend = determineTrend(sma20, sma50, sma200, ltp);
      const foAnalysis = computeFOAnalysis(ltp, atr, sma20, scores, rsi);

      const generatedAt = new Date(now).toISOString();
      const quoteTime = Number.isFinite(q.regularMarketTime) ? new Date(q.regularMarketTime * 1000).toISOString() : undefined;
      const blockedReasons: string[] = [];
      if (!freshQuote({ price: ltp, timestamp: quoteTime || '', source: 'Yahoo' }, now)) blockedReasons.push('Quote older than 2 minutes or timestamp missing');
      if (ltp < 50) blockedReasons.push('Price below ₹50 research liquidity guard');
      if (avgVol * ltp < 100_000_000) blockedReasons.push('Average daily turnover below ₹10 crore');
      if (Math.abs(changePct) > 8) blockedReasons.push('Large daily move; chasing/circuit risk');
      if (!validLevels(overallScore >= 0 ? 'BUY' : 'SELL', ltp, foAnalysis.suggestedStopLoss, foAnalysis.suggestedTarget)) blockedReasons.push('Invalid risk levels');
      return {
        generatedAt, quoteTime, eligible: blockedReasons.length === 0, blockedReasons,
        symbol: symbol.replace('.NS', ''),
        name: q.longName || q.shortName || symbol.replace('.NS', ''),
        exchange: 'NSE',
        ltp,
        change,
        changePct,
        volume: vol,
        avgVolume: avgVol,
        volumeRatio: Math.round(volumeRatio * 10) / 10,
        dayHigh: Number.isFinite(q.regularMarketDayHigh) ? q.regularMarketDayHigh : null,
        dayLow: Number.isFinite(q.regularMarketDayLow) ? q.regularMarketDayLow : null,
        open: Number.isFinite(q.regularMarketOpen) ? q.regularMarketOpen : null,
        prevClose,
        weekHigh52,
        weekLow52,
        sma50: Math.round(sma50 * 100) / 100,
        sma200: Math.round(sma200 * 100) / 100,
        marketCap: Number.isFinite(q.marketCap) ? q.marketCap : null,
        rsi: Math.round(rsi * 10) / 10,
        macd,
        sma20: Math.round(sma20 * 100) / 100,
        trend,
        scores,
        overallScore,
        signal,
        reasons,
        strategies,
        foAnalysis,
      } as DiscoveredStock;
}
