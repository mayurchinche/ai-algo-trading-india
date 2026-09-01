// ponytail: route API calls through serverless proxy on Vercel, Vite proxy locally
const IS_PROD = !import.meta.env.DEV;

// Map of Vite proxy prefixes to real base URLs
const PROXY_MAP: Record<string, string> = {
  '/api/yahoo': 'https://query1.finance.yahoo.com',
  '/api/ipo': 'https://webnodejs.investorgain.com',
  '/api/goodreturns': 'https://www.goodreturns.in',
  '/api/nse': 'https://www.nseindia.com',
  '/api/broker/dhan-auth': 'https://auth.dhan.co',
  '/api/broker/dhan': 'https://api.dhan.co',
  '/api/broker/angel': 'https://apiconnect.angelbroking.com',
  '/api/telegram': 'https://api.telegram.org',
};

/**
 * Convert a local Vite proxy path to the correct URL for the environment.
 * Local dev: returns path as-is (Vite proxy handles it)
 * Production (Vercel): routes through /api/proxy serverless function
 */
export function apiUrl(localPath: string): string {
  if (!IS_PROD) return localPath;

  // Find matching proxy prefix (longest match first)
  const sorted = Object.keys(PROXY_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (localPath.startsWith(prefix)) {
      const realUrl = PROXY_MAP[prefix] + localPath.slice(prefix.length);
      return `/api/proxy?url=${encodeURIComponent(realUrl)}`;
    }
  }

  return localPath; // No match, return as-is
}
