import { backend, check } from './pushBackend.js';
import { validateAlert } from './alertPolicy.js';
import { sendPush } from './pushDelivery.js';
export async function dispatchAlerts(db = backend(), send = sendPush) {
  const jobs = check(await db.rpc('claim_mobile_push_jobs')) || [];
  return Promise.all(jobs.map(async job => {
    const finish = async patch => check(await db.from('mobile_push_jobs').update({ ...patch, lease_until: null }).eq('id', job.id).eq('lease_id', job.lease_id));
    try {
      const device = check(await db.from('mobile_push_devices').select('*').eq('id', job.device_id).maybeSingle());
      const alert = check(await db.from('mobile_alerts').select('*').eq('id', job.alert_id).maybeSingle());
      const prefs = check(await db.from('mobile_alert_preferences').select('*').eq('user_id', job.user_id).maybeSingle());
      if (!device?.enabled || device.user_id !== job.user_id || alert?.user_id !== job.user_id || !prefs?.enabled || !prefs[alert.payload.assetClass === 'OPTIONS' ? 'options_enabled' : 'equity_enabled'] || Math.abs(alert.payload.score) < prefs.min_score) {
        await finish({ status:'cancelled' }); return 'cancelled';
      }
      try { validateAlert(alert.payload); } catch { await finish({ status:'expired' }); return 'expired'; }
      const receipt = await send(device, alert.payload, alert.id);
      // Provider acceptance is NOT a device-delivery receipt.
      await finish({ status:'accepted', provider_receipt:String(receipt), accepted_at:new Date().toISOString(), error_code:null });
      return 'accepted';
    } catch (error) {
      if (error.invalidToken) check(await db.from('mobile_push_devices').update({ enabled:false }).eq('id',job.device_id).eq('user_id',job.user_id));
      await finish({ status:error.invalidToken || job.attempts>=3 ? 'failed' : 'pending', error_code:error.invalidToken ? 'invalid_token' : 'provider_or_storage_error', next_attempt_at:new Date(Date.now()+job.attempts*15000).toISOString() });
      return 'retry_or_failed';
    }
  }));
}
