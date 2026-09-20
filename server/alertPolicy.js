// Shared by the worker and delivery service. The score is a heuristic, never a probability.
export const STRONG_SCORE = 70;
export const STRATEGY_VERSION = 'composite-research-v3';
export function validateAlert(signal, now = Date.now()) {
  if (!signal || !['EQUITY', 'OPTIONS'].includes(signal.assetClass)) throw new Error('Unsupported asset class');
  if (!['BUY', 'SELL'].includes(signal.side) || !/^[A-Z0-9&._-]{1,40}$/.test(signal.symbol || '')) throw new Error('Invalid instrument');
  if (![signal.score, signal.entry, signal.stop, signal.target].every(Number.isFinite) || Math.abs(signal.score) < STRONG_SCORE || Math.abs(signal.score) > 100) throw new Error('Not a strong signal');
  if (Math.min(signal.entry, signal.stop, signal.target) <= 0 || !(signal.side === 'BUY' ? signal.stop < signal.entry && signal.entry < signal.target : signal.target < signal.entry && signal.entry < signal.stop)) throw new Error('Invalid risk levels');
  const generated = Date.parse(signal.generatedAt), quote = Date.parse(signal.quoteTime), expires = Date.parse(signal.expiresAt);
  if (![generated, quote, expires].every(Number.isFinite) || generated > now + 5000 || quote > now + 5000 || now - generated > 120000 || now - quote > 120000 || expires <= now || expires > quote + 120000) throw new Error('Expired or invalid timestamps');
  if (typeof signal.id !== 'string' || signal.id.length > 160 || !/^[a-zA-Z0-9:._-]+$/.test(signal.id) || typeof signal.strategyVersion !== 'string' || signal.strategyVersion.length > 80) throw new Error('Missing signal identity');
  if (signal.assetClass === 'EQUITY' && ((signal.score > 0) !== (signal.side === 'BUY'))) throw new Error('Score and direction disagree');
  if (signal.assetClass === 'OPTIONS') {
    const c = signal.contract;
    if (!c || c.verified !== true || !['CE', 'PE'].includes(c.optionType) || typeof c.instrumentId !== 'string' || !c.instrumentId || !Number.isInteger(c.lotSize) || c.lotSize < 1 || !Number.isFinite(c.strike) || c.strike <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(c.expiry || '') || Date.parse(`${c.expiry}T10:00:00Z`) <= now) throw new Error('Verified option contract required');
    if (![c.bid, c.ask].every(Number.isFinite) || c.bid <= 0 || c.ask < c.bid || (c.ask - c.bid) / c.ask > .05 || Date.parse(c.quoteTime) !== quote) throw new Error('Fresh liquid option premium required');
    if (Math.abs(signal.entry - (signal.side === 'BUY' ? c.ask : c.bid)) > .01) throw new Error('Entry must be option premium, not underlying price');
  }
  return signal;
}
export function equityAlert(stock, now = Date.now()) {
  if (!stock.eligible || !Number.isFinite(Date.parse(stock.quoteTime))) return null;
  const side = stock.overallScore > 0 ? 'BUY' : 'SELL';
  const session = new Date(now + 330 * 60000).toISOString().slice(0, 10);
  const signal = { id: `${STRATEGY_VERSION}:${session}:${stock.symbol}:${side}`, assetClass: 'EQUITY', symbol: stock.symbol, side,
    score: stock.overallScore, entry: stock.ltp, stop: stock.foAnalysis.suggestedStopLoss, target: stock.foAnalysis.suggestedTarget,
    generatedAt: stock.generatedAt, quoteTime: stock.quoteTime, expiresAt: new Date(Math.min(Date.parse(stock.quoteTime) + 120000, Date.parse(session + 'T10:00:00Z'))).toISOString(), strategyVersion: STRATEGY_VERSION,
    assessment: 'Unvalidated research signal' };
  try { return validateAlert(signal, now); } catch { return null; }
}
export function notificationContent(signal) {
  const time = new Date(signal.generatedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const contract = signal.assetClass === 'OPTIONS' ? ` ${signal.contract.strike} ${signal.contract.optionType} ${signal.contract.expiry}` : '';
  return { title: `${signal.side} ${signal.symbol}${contract} · Strong research signal`, body: `${time} IST · ₹${signal.entry.toFixed(2)} · SL ₹${signal.stop.toFixed(2)} · Target ₹${signal.target.toFixed(2)}. Verify before trading.` };
}
