// Network-only: never replay stale market data or authenticated responses.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => new Response('<h1>AlgoTrader is offline</h1><p>Reconnect to view your journal. No trading observations are running.</p>', { headers: { 'Content-Type': 'text/html' } })));
});
