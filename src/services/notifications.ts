// ponytail: notifications via Telegram Bot (primary, safe) or WhatsApp CallMeBot (optional)
// Telegram: no phone number exposed, official API, free, unlimited
// WhatsApp: uses CallMeBot third-party — only use with a secondary number

export interface NotificationSettings {
  enabled: boolean;
  channel: 'telegram' | 'whatsapp';
  // Telegram settings
  telegramBotToken: string;  // from @BotFather
  telegramChatId: string;    // your chat ID
  // WhatsApp settings (optional, secondary number only)
  phone: string;
  apiKey: string;  // CallMeBot API key
  // What to notify
  ipoApplied: boolean;
  ipoMandatePending: boolean;
  ipoAllotment: boolean;
  tradeOpened: boolean;
  tradeClosed: boolean;
  signalAlert: boolean;
  dailySummary: boolean;
}

const SETTINGS_KEY = 'notification_settings_v2';
const LAST_SENT_KEY = 'notification_last_sent';
const MIN_INTERVAL_MS = 1000; // Telegram allows ~30 msg/sec, CallMeBot ~1 per 3s

export function getNotificationSettings(): NotificationSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    enabled: false,
    channel: 'telegram',
    telegramBotToken: '',
    telegramChatId: '',
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

// Send via Telegram Bot API (official, free, safe)
async function sendViaTelegram(botToken: string, chatId: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/telegram/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    if (res.ok) {
      console.log('[Telegram] Message sent');
      return true;
    }
    const err = await res.json().catch(() => ({}));
    console.warn('[Telegram] Send failed:', err.description || res.status);
    return false;
  } catch (e) {
    console.warn('[Telegram] Error:', e);
    return false;
  }
}

// Send a WhatsApp message via CallMeBot (use with secondary number only)
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

export async function notify(type: keyof Omit<NotificationSettings, 'enabled' | 'phone' | 'apiKey' | 'channel' | 'telegramBotToken' | 'telegramChatId'>, message: string): Promise<boolean> {
  const settings = getNotificationSettings();
  if (!settings.enabled) return false;
  if (!settings[type]) return false;

  if (settings.channel === 'telegram') {
    if (!settings.telegramBotToken || !settings.telegramChatId) return false;
    return sendViaTelegram(settings.telegramBotToken, settings.telegramChatId, message);
  } else {
    if (!settings.phone || !settings.apiKey) return false;
    return sendViaCallMeBot(settings.phone, settings.apiKey, message);
  }
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
  const msg = `✅ *AlgoTrader AI Connected*\nNotifications are working!\nYou'll receive alerts for IPO applications, trades, and signals.`;

  if (settings.channel === 'telegram') {
    if (!settings.telegramBotToken || !settings.telegramChatId) return false;
    return sendViaTelegram(settings.telegramBotToken, settings.telegramChatId, msg);
  } else {
    if (!settings.phone || !settings.apiKey) return false;
    return sendViaCallMeBot(settings.phone, settings.apiKey, msg);
  }
}
