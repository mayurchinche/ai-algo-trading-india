// Page ↔ URL hash, so every page can be linked, bookmarked and reached with Back: #/stacks, #/analysis/INFY.
const slug = (tab: string) => tab.toLowerCase().replace(/\s+/g, '-');
export function routeHash(tab: string, symbol?: string) {
 return '#/' + slug(tab) + (tab === 'Analysis' && symbol ? '/' + encodeURIComponent(symbol) : '');
}
// Unknown pages and malformed symbols are ignored rather than guessed.
export function parseRoute(hash: string, tabs: readonly string[]): { tab: string; symbol?: string } | null {
 const m = /^#\/([a-z0-9-]+)(?:\/([^/]+))?$/.exec(hash);
 if (!m) return null;
 const tab = tabs.find(t => slug(t) === m[1]);
 if (!tab) return null;
 let symbol: string | undefined;
 if (tab === 'Analysis' && m[2]) { try { const s = decodeURIComponent(m[2]).toUpperCase(); if (/^[A-Z0-9&-]{1,30}$/.test(s)) symbol = s; } catch { /* malformed escape */ } }
 return { tab, symbol };
}
