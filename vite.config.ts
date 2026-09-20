import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// @ts-expect-error JavaScript Vercel handler is shared with local development.
import marketHandler from './api/market.js'

// @ts-expect-error Shared JavaScript configuration validator.
import { validateMobileApiBase } from './server/mobileConfig.js'
// @ts-expect-error Shared JavaScript Vercel handler.
import healthHandler from './api/health.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (mode === 'mobile') validateMobileApiBase(env.VITE_API_BASE_URL);
  return {
  base: process.env.GITHUB_ACTIONS ? '/ai-algo-trading-india/' : '/',
  plugins: [react(), tailwindcss(), {
    name: 'local-market-api',
    configureServer(server) {
      for (const [route, handler] of [['/api/market', marketHandler], ['/api/health', healthHandler]] as const) server.middlewares.use(route, (req, res) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const request = { headers: req.headers, method: req.method, query: Object.fromEntries(url.searchParams) };
        const response = { end() { res.end(); return response; }, setHeader: (key: string, value: string) => res.setHeader(key, value), status(code: number) { res.statusCode = code; return response; }, json(data: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return response; } };
        void handler(request, response);
      });
    },
  }],
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      },
      '/api/ipo': {
        target: 'https://webnodejs.investorgain.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ipo/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Origin': 'https://www.investorgain.com',
          'Referer': 'https://www.investorgain.com/',
        },
      },
      '/api/goodreturns': {
        target: 'https://www.goodreturns.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/goodreturns/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      },
      '/api/nse': {
        target: 'https://www.nseindia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nse/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.nseindia.com/',
        },
      },
      '/api/broker/angel': {
        target: 'https://apiconnect.angelbroking.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/broker\/angel/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      },
      '/api/broker/dhan-auth': {
        target: 'https://auth.dhan.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/broker\/dhan-auth/, ''),
        headers: { 'Origin': 'https://auth.dhan.co' },
      },
      '/api/broker/dhan': {
        target: 'https://api.dhan.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/broker\/dhan/, ''),
        headers: { 'Origin': 'https://api.dhan.co' },
      },
      '/api/telegram': {
        target: 'https://api.telegram.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/telegram/, ''),
      },
    },
  },
}
})
