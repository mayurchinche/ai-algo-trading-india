import { useEffect } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { alertRequest, installationId } from '../services/mobileAlerts';
import { getSupabase } from '../services/supabaseClient';
export function useNativeAlerts(onOpen: (id: string) => void) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handles: PluginListenerHandle[] = [];
    let disposed = false;
    const keep = async (handle: Promise<PluginListenerHandle>) => { const h = await handle; if (disposed) await h.remove(); else handles.push(h); };
    void keep(PushNotifications.addListener('pushNotificationActionPerformed', action => {
      const id = action.notification.data?.alertId;
      if (typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id)) onOpen(id);
    }));
    void keep(PushNotifications.addListener('pushNotificationReceived', () => window.dispatchEvent(new Event('mobile-alert-received'))));
    void keep(PushNotifications.addListener('registration', token => {
      if (localStorage.getItem('native_push_opt_in') === 'true') void alertRequest('POST', { installationId: installationId(), platform: Capacitor.getPlatform(), token: token.value }).catch(() => window.dispatchEvent(new Event('mobile-alert-registration-failed')));
    }));
    // Restore token registration without prompting on launch; refresh it after authenticated sign-in.
    const refresh = async () => {
      if (localStorage.getItem('native_push_opt_in') !== 'true') return;
      if (!(await getSupabase()?.auth.getSession())?.data.session) return;
      if ((await PushNotifications.checkPermissions()).receive === 'granted') await PushNotifications.register();
    };
    const auth = getSupabase()?.auth.onAuthStateChange(() => { void refresh().catch(() => {}); });
    void refresh().catch(() => {});
    return () => { disposed = true; handles.forEach(h => void h.remove()); auth?.data.subscription.unsubscribe(); };
  }, [onOpen]);
}
