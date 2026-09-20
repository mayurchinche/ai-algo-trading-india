export const DAY_MS = 86_400_000;
export function istDate(value: string | number | Date = Date.now()): string {
  return new Date(new Date(value).getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
export function istMinutes(value: string | number | Date = Date.now()): number {
  const d = new Date(new Date(value).getTime() + 330 * 60_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
export function inSession(value: string | number | Date = Date.now()): boolean {
  const d = new Date(new Date(value).getTime() + 330 * 60_000);
  return d.getUTCDay() > 0 && d.getUTCDay() < 6 && istMinutes(value) >= 555 && istMinutes(value) < 930;
}
export function formatIST(value?: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' IST';
}
export interface MarketQuote { price: number; timestamp: string; source: string }
export function freshQuote(q: MarketQuote | undefined, now = Date.now()): q is MarketQuote {
  if (!q || !Number.isFinite(q.price) || q.price <= 0) return false;
  const age = now - Date.parse(q.timestamp);
  return Number.isFinite(age) && age >= -5_000 && age <= 120_000;
}
export function validLevels(side: 'BUY' | 'SELL', entry: number, stop: number, target: number): boolean {
  return [entry, stop, target].every(v => Number.isFinite(v) && v > 0) &&
    (side === 'BUY' ? stop < entry && entry < target : target < entry && entry < stop);
}
