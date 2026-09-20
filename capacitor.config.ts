import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.algotrader.research',
  appName: 'AlgoTrader',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: { PushNotifications: { presentationOptions: ['badge', 'sound', 'banner', 'list'] } },
};
export default config;
