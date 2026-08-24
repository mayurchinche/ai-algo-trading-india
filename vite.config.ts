import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
})
