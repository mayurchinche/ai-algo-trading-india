import { allowRequest } from '../server/pushBackend.js';
export default function handler(req, res) {
  if (!allowRequest(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
  return res.status(200).json({ status: 'ok', service: 'algotrader-market-api', apiVersion: 1, checkedAt: new Date().toISOString(), dataProvider: 'Yahoo research feed', marketStatusProvider: 'NSE', notifications: 'foreground-only' });
}
