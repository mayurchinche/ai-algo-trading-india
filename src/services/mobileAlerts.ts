import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getSupabase } from './supabaseClient';

export interface AlertPreferences { enabled: boolean; equity_enabled: boolean; options_enabled: boolean; min_score: number }
export interface MobileAlert {
  id: string; created_at: string; opened_at?: string;
  payload: { id: string; assetClass: 'EQUITY' | 'OPTIONS'; symbol: string; side: string; score: number; entry: number; stop: number; target: number; generatedAt: string; quoteTime: string; expiresAt: string; strategyVersion: string; contract?: { strike: number; optionType: string; expiry: string; lotSize: number } };
}
export const defaultAlertPreferences: AlertPreferences = { enabled: false, equity_enabled: true, options_enabled: false, min_score: 70 };
export function installationId() {
  let id = localStorage.getItem('push_installation_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('push_installation_id', id); }
  return id;
}
export async function alertRequest<T>(method = 'GET', body?: unknown): Promise<T> {
  const session = await getSupabase()?.auth.getSession();
  if (!session?.data.session) throw new Error('Sign in before enabling phone alerts.');
  const base = import.meta.env.VITE_API_BASE_URL || '';
  if (Capacitor.isNativePlatform() && !base.startsWith('https://')) throw new Error('The mobile app needs a configured HTTPS backend.');
  const response = await fetch(`${base}/api/mobile-alerts`, { method, headers: { Authorization: `Bearer ${session.data.session.access_token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(response.status === 401 ? 'Your sign-in expired. Sign in again.' : 'Alert backend unavailable. Preferences were not confirmed saved.');
  return response.json();
}
export async function enableDevicePush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) throw new Error('Install the Android or iOS app to enable native phone alerts.');
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') throw new Error('Notifications are disabled in system settings.');
  if (Capacitor.getPlatform() === 'android') await PushNotifications.createChannel({ id: 'strong-signals', name: 'Strong trading signals', description: 'Time-sensitive research signals', importance: 5, visibility: 0, sound: 'default', vibration: true });
  const handles: PluginListenerHandle[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Phone registration timed out. Check native push configuration.')), 20000);
      const finish = (error?: unknown) => { clearTimeout(timer); if (error) reject(error); else resolve(); };
      void (async () => {
        handles.push(await PushNotifications.addListener('registration', token => {
          void alertRequest('POST', { installationId: installationId(), platform: Capacitor.getPlatform(), token: token.value }).then(() => finish(), finish);
        }));
        handles.push(await PushNotifications.addListener('registrationError', () => finish(new Error('Native push registration failed.'))));
        await PushNotifications.register();
      })().catch(finish);
    });
  } finally { await Promise.all(handles.map(handle => handle.remove())); }
  localStorage.setItem('native_push_opt_in', 'true');
}
export async function disableDevicePush() {
  await alertRequest('DELETE', { installationId: installationId() });
  if (Capacitor.isNativePlatform()) await PushNotifications.unregister();
  localStorage.removeItem('native_push_opt_in');
}
