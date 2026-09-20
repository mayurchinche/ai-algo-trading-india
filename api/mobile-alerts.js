import { allowRequest, backend, signedInUser, check } from '../server/pushBackend.js';
export default async function handler(req, res) {
  if (!allowRequest(req, res)) return;
  try {
    const user = await signedInUser(req);
    if (!user) return res.status(401).json({ error: 'Sign in to manage your mobile alerts' });
    const db = backend();
    if (req.method === 'GET') {
      const alerts = check(await db.from('mobile_alerts').select('id,payload,created_at,opened_at').eq('user_id', user.id).gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('created_at', { ascending: false }).limit(100));
      const preferences = check(await db.from('mobile_alert_preferences').select('enabled,equity_enabled,options_enabled,min_score').eq('user_id', user.id).maybeSingle());
      return res.json({ alerts, preferences: preferences || { enabled: false, equity_enabled: true, options_enabled: false, min_score: 70 } });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (req.method === 'PATCH') {
      if (body?.alertId) {
        if (typeof body.alertId !== 'string' || body.alertId.length > 100) return res.status(400).json({ error: 'Invalid alert ID' });
        check(await db.from('mobile_alerts').update({ opened_at: new Date().toISOString() }).eq('id', body.alertId).eq('user_id', user.id));
      } else {
        const { enabled, equity_enabled, options_enabled, min_score } = body || {};
        if (![enabled, equity_enabled, options_enabled].every(v => typeof v === 'boolean') || !Number.isInteger(min_score) || min_score < 70 || min_score > 100) return res.status(400).json({ error: 'Invalid preferences' });
        check(await db.from('mobile_alert_preferences').upsert({ user_id: user.id, enabled, equity_enabled, options_enabled, min_score }));
      }
      return res.json({ ok: true });
    }
    if (!/^[a-f0-9-]{36}$/i.test(body?.installationId || '')) return res.status(400).json({ error: 'Invalid installation' });
    if (req.method === 'DELETE') {
      check(await db.from('mobile_push_devices').update({ enabled: false }).eq('user_id', user.id).eq('installation_id', body.installationId));
      return res.json({ ok: true });
    }
    if (req.method === 'POST') {
      if (!['android', 'ios'].includes(body.platform) || typeof body.token !== 'string' || body.token.length < 16 || body.token.length > 4096 || /\s/.test(body.token)) return res.status(400).json({ error: 'Invalid native token' });
      // Disable superseded tokens for this installation before registering the current token.
      check(await db.from('mobile_push_devices').update({ enabled: false }).eq('installation_id', body.installationId).eq('user_id', user.id));
      check(await db.from('mobile_push_devices').upsert({ user_id: user.id, installation_id: body.installationId, platform: body.platform, token: body.token, enabled: true, updated_at: new Date().toISOString() }, { onConflict: 'platform,token' }));
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch { return res.status(503).json({ error: 'Mobile alert service unavailable. Check backend configuration and migrations.' }); }
}
