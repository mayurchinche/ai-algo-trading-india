export const NSE_HOLIDAYS: Readonly<Record<number, readonly string[]>>;
export function isNseTradingDay(date: string): boolean;
export function nextNseTradingDay(date: string): string;
export function previousNseTradingDay(date: string): string;
