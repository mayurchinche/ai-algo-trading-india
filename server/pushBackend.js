import { createClient } from '@supabase/supabase-js';
let client;
export function backend() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Push backend is not configured');
  return client ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function allowRequest(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const origin = req.headers.origin;
  const allowed = (process.env.MOBILE_ALLOWED_ORIGINS || 'capacitor://localhost,https://localhost').split(',');
  const host = req.headers.host;
  if (origin && origin !== `https://${host}` && origin !== `http://${host}`) {
    if (!allowed.includes(origin)) { res.status(403).json({ error: 'Origin not allowed' }); return false; }
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return false; }
  return true;
}
export async function signedInUser(req) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const { data, error } = await backend().auth.getUser(token);
  return error ? null : data.user;
}
export function check(result) { if (result.error) throw new Error('Database operation failed'); return result.data; }
