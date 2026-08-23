// ponytail: WhatsApp notifications via CallMeBot (free, no server needed)
// Setup: user sends "I allow callmebot to send me messages" to +34 644 71 99 23 on WhatsApp
// Then gets an apikey — that's it. No business account, no Meta approval.

export interface NotificationSettings {
  enabled: boolean;
  phone: string;       // e.g. "919657491288" (with country code, no +)
  apiKey: string;       // CallMeBot API key
  // What to notify
  ipoApplied: boolean;
  ipoMandatePending: boolean;
  ipoAllotment: boolean;
  tradeOpened: boolean;
  tradeClosed: boolean;
  signalAlert: boolean; // High-conviction signal (score ≥ 70)
  dailySummary: boolean;
}

const SETTINGS_KEY = 'whatsapp_notification_settings';
const LAST_SENT_KEY = 'notification_last_sent';
// ponytail: CallMeBot rate limit ~1 msg per 2 seconds
const MIN_INTERVAL_MS = 3000;

export function getNotificationSettings(): NotificationSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    enabled: false,
    phone: '',
    apiKey: '',
    ipoApplied: true,
    ipoMandatePending: true,
    ipoAllotment: true,
    tradeOpened: true,
    tradeClosed: true,
    signalAlert: true,
    dailySummary: true,
  };
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Send a WhatsApp message via CallMeBot
async function sendViaCallMeBot(phone: string, apiKey: string, message: string): Promise<boolean> {
  try {
    // Rate limit
    const lastSent = parseInt(localStorage.getItem(LAST_SENT_KEY) || '0');
    const now = Date.now();
    if (now - lastSent < MIN_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - (now - lastSent)));
    }

    const encodedMsg = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMsg}&apikey=${apiKey}`;

    const res = await fetch(url);
    localStorage.setItem(LAST_SENT_KEY, Date.now().toString());

    if (res.ok) {
      console.log('[WhatsApp] Message sent successfully');
      return true;
    }
    console.warn('[WhatsApp] Send failed:', res.status);
    return false;
  } catch (e) {
    console.warn('[WhatsApp] Error:', e);
    return false;
  }
}

// --- Public API: send typed notifications ---

export async function notify(type: keyof Omit<NotificationSettings, 'enabled' | 'phone' | 'apiKey'>, message: string): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.phone || !settings.apiKey) return false;
  if (!settings[type]) return false;

  return sendViaCallMeBot(settings.phone, settings.apiKey, message);
}

// Convenience methods for each notification type

export async function notifyIPOApplied(ipoName: string, lots: number, amount: number): Promise<void> {
  await notify('ipoApplied',
    `🚀 *IPO Applied*\n` +
    `📋 ${ipoName}\n` +
    `📦 ${lots} lot(s) • ₹${amount.toLocaleString('en-IN')}\n` +
    `⏳ UPI mandate sent — approve on your phone within 30 mins!`
  );
}

export async function notifyIPOMandatePending(ipoName: string, upiId: string): Promise<void> {
  await notify('ipoMandatePending',
    `⚠️ *UPI Mandate Pending*\n` +
    `📋 ${ipoName}\n` +
    `💳 Approve mandate on ${upiId}\n` +
    `⏰ Expires in 30 minutes — act now!`
  );
}

export async function notifyIPOAllotment(ipoName: string, allotted: boolean): Promise<void> {
  await notify('ipoAllotment',
    allotted
      ? `🎉 *IPO Allotted!*\n📋 ${ipoName}\n✅ Shares allotted to your demat account`
      : `😔 *IPO Not Allotted*\n📋 ${ipoName}\n❌ Better luck next time`
  );
}

export async function notifyTradeOpened(symbol: string, side: string, qty: number, price: number, strategy: string): Promise<void> {
  await notify('tradeOpened',
    `📈 *Paper Trade Opened*\n` +
    `${side === 'BUY' ? '🟢' : '🔴'} ${side} ${symbol}\n` +
    `📦 ${qty} shares @ ₹${price.toFixed(2)}\n` +
    `📊 Strategy: ${strategy}`
  );
}

export async function notifyTradeClosed(symbol: string, side: string, netPnl: number, pnlPct: number, reason: string): Promise<void> {
  const emoji = netPnl >= 0 ? '✅' : '❌';
  await notify('tradeClosed',
    `${emoji} *Paper Trade Closed*\n` +
    `${side === 'BUY' ? '🟢' : '🔴'} ${symbol}\n` +
    `💰 Net P&L: ${netPnl >= 0 ? '+' : ''}₹${netPnl.toLocaleString('en-IN')} (${pnlPct >= 0 ? '+' : ''}${pnlPct}%)\n` +
    `📋 Reason: ${reason}`
  );
}

export async function notifySignalAlert(symbol: string, signal: string, score: number, price: number, target: number, sl: number): Promise<void> {
  await notify('signalAlert',
    `🔔 *High Conviction Signal*\n` +
    `${signal.includes('BUY') ? '🟢' : '🔴'} ${signal} ${symbol}\n` +
    `📊 AI Score: ${score}/100\n` +
    `💰 LTP: ₹${price.toFixed(2)}\n` +
    `🎯 Target: ₹${target.toFixed(2)} | SL: ₹${sl.toFixed(2)}`
  );
}

export async function notifyDailySummary(stats: {
  totalTrades: number;
  wins: number;
  losses: number;
  netPnl: number;
  winRate: number;
}): Promise<void> {
  await notify('dailySummary',
    `📊 *Daily Trading Summary*\n` +
    `📅 ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' })}\n` +
    `📈 Trades: ${stats.totalTrades} (${stats.wins}W / ${stats.losses}L)\n` +
    `🏆 Win Rate: ${stats.winRate}%\n` +
    `💰 Net P&L: ${stats.netPnl >= 0 ? '+' : ''}₹${stats.netPnl.toLocaleString('en-IN')}`
  );
}

// Test notification
export async function sendTestNotification(): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.phone || !settings.apiKey) return false;
  return sendViaCallMeBot(settings.phone, settings.apiKey,
    `✅ *AlgoTrader AI Connected*\n` +
    `WhatsApp notifications are working!\n` +
    `You'll receive alerts for IPO applications, trades, and signals.`
  );
}
