import type { DiscoveredStock } from './stockDiscovery';
export const OPTIONS_UNAVAILABLE = 'Options unavailable: connect a verified contract master, expiry list, lot sizes and timestamped bid/ask quotes. No estimated premiums or profit probabilities are generated.';
export function generateOptionsPicks(_stocks: DiscoveredStock[]): never {
  throw new Error(OPTIONS_UNAVAILABLE);
}
