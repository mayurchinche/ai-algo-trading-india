import { createSign } from 'node:crypto';
import { connect } from 'node:http2';
import { notificationContent } from './alertPolicy.js';
let firebase, apnsJwt, apnsJwtAt = 0;
export function androidMessage(token, signal, alertId, now = Date.now()) {
  const ttl = Math.max(0, Math.min(120000, Date.parse(signal.expiresAt) - now));
  if (!ttl) throw new Error('Alert expired');
  return { token, notification: notificationContent(signal), data: { alertId, signalId: signal.id, expiresAt: signal.expiresAt }, android: { priority: 'high', ttl, notification: { channelId: 'strong-signals', tag: alertId, sound: 'default' } } };
}
function appleToken() {
  if (apnsJwt && Date.now() - apnsJwtAt < 40 * 60000) return apnsJwt;
  const { APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY } = process.env;
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) throw new Error('APNs is not configured');
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'ES256', kid: APNS_KEY_ID })}.${encode({ iss: APNS_TEAM_ID, iat: Math.floor(Date.now()/1000) })}`;
  const signer = createSign('SHA256'); signer.update(unsigned); signer.end();
  apnsJwt = `${unsigned}.${signer.sign({ key: APNS_PRIVATE_KEY.replace(/\\n/g, '\n'), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  apnsJwtAt = Date.now(); return apnsJwt;
}
async function sendApple(token, signal, alertId) {
  if (!/^[a-f0-9]+$/i.test(token) || !process.env.APNS_BUNDLE_ID || !['sandbox','production'].includes(process.env.APNS_ENVIRONMENT)) throw new Error('APNs configuration or token invalid');
  const jwt = appleToken();
  const host = process.env.APNS_ENVIRONMENT === 'production' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
  return new Promise((resolve, reject) => {
    const client = connect(host); let settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); client.close(); if (error) reject(error); else resolve(value); };
    const timer = setTimeout(() => { client.destroy(); finish(new Error('APNs timeout')); }, 10000);
    client.on('error', error => finish(error));
    const req = client.request({ ':method':'POST', ':path':`/3/device/${token}`, authorization:`bearer ${jwt}`, 'apns-topic':process.env.APNS_BUNDLE_ID, 'apns-push-type':'alert', 'apns-priority':'10', 'apns-expiration':String(Math.floor(Date.parse(signal.expiresAt)/1000)), 'apns-collapse-id':alertId });
    let status, receipt, body = '';
    req.on('response', headers => { status = headers[':status']; receipt = headers['apns-id']; });
    req.on('data', chunk => { body += chunk; }); req.on('error', error => finish(error));
    req.on('end', () => { if (status === 200) finish(null, receipt); else { const error = new Error(`APNs ${status}`); error.invalidToken = status === 410 || body.includes('BadDeviceToken'); finish(error); } });
    const content = notificationContent(signal);
    req.end(JSON.stringify({ aps: { alert: content, sound:'default', 'thread-id':'strong-signals' }, alertId, signalId:signal.id, expiresAt:signal.expiresAt }));
  });
}
export async function sendPush(device, signal, alertId) {
  if (Date.parse(signal.expiresAt) <= Date.now()) throw new Error('Alert expired');
  if (device.platform === 'ios') return sendApple(device.token, signal, alertId);
  if (!firebase) {
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('FCM is not configured');
    firebase = getMessaging(initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) }, 'mobile-signal-alerts'));
  }
  try { return await firebase.send(androidMessage(device.token, signal, alertId)); }
  catch (error) { error.invalidToken = ['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code); throw error; }
}
