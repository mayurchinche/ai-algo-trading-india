import { useState, useEffect } from 'react';
import type { LiveStock } from '../services/liveData';
import { fetchMarketStatus } from '../services/marketStatus';
import { getNotificationSettings, saveNotificationSettings, sendTestNotification, type NotificationSettings } from '../services/notifications';

interface HeaderProps {
  activeTab: string;
  onTabChange: (t: string) => void;
  nifty: LiveStock | null;
  lastUpdated: Date | null;
}

export function Header({ activeTab, onTabChange, nifty }: HeaderProps) {
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketLabel, setMarketLabel] = useState('...');
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  useEffect(() => {
    fetchMarketStatus().then(s => { setMarketOpen(s.isOpen); setMarketLabel(s.status); });
    const interval = setInterval(() => {
      fetchMarketStatus().then(s => { setMarketOpen(s.isOpen); setMarketLabel(s.status); });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const now = new Date();
  const tabs = ['AI Discovery', 'Smart Picks', 'Overview', 'Trades', 'Stock Analysis', 'Signals', 'Backtest', 'IPO Tracker', 'Metals'];

  return (
    <header className="sticky top-0 z-50 glass border-b border-[rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between px-8 xl:px-12 py-4 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">AT</div>
          <div>
            <h1 className="text-[15px] font-semibold text-[var(--text)]" style={{ fontFamily: 'Poppins', letterSpacing: '-0.01em' }}>AlgoTrader AI</h1>
            <p className="text-[11px] text-[var(--text-muted)]">NSE • Live Discovery • Paper Mode</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-6">
          {nifty && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[rgba(0,0,0,0.02)] border border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">NIFTY 50</span>
              <span className="text-[15px] font-bold text-[var(--text)]" style={{ fontFamily: 'Poppins', letterSpacing: '-0.02em' }}>
                {nifty.ltp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              <span className={`text-xs font-semibold ${nifty.changePct >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                {nifty.changePct >= 0 ? '↑' : '↓'} {Math.abs(nifty.changePct).toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* WhatsApp notification bell */}
          <button
            onClick={() => setShowNotifPanel(!showNotifPanel)}
            className={`relative p-2 rounded-lg transition-all hover:bg-[var(--bg-alt)] ${notifSettings.enabled ? 'text-[var(--green)]' : 'text-[var(--text-muted)]'}`}
            title="WhatsApp Notifications"
          >
            🔔
            {notifSettings.enabled && <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--green)] rounded-full"></span>}
          </button>
          <span className="text-[11px] text-[var(--text-muted)]">
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium ${marketOpen ? 'bg-[var(--green-bg)] text-[var(--green)]' : 'bg-[var(--red-bg)] text-[var(--red)]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'bg-[var(--green)] pulse' : 'bg-[var(--red)]'}`}></span>
            {marketLabel}
          </div>
        </div>
      </div>

      <div className="px-8 xl:px-12 max-w-[1600px] mx-auto">
        <div className="tab-bar overflow-x-auto">
          {tabs.map((t) => (
            <div key={t} className={`tab whitespace-nowrap ${activeTab === t ? 'active' : ''}`} onClick={() => onTabChange(t)}>{t}</div>
          ))}
        </div>
      </div>

      {/* WhatsApp Notification Settings Panel */}
      {showNotifPanel && (
        <div className="absolute right-8 top-16 w-96 card z-50 shadow-2xl border border-[var(--border)]" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'Poppins' }}>🔔 Notifications</h3>
            <button onClick={() => setShowNotifPanel(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">✕</button>
          </div>

          <div className="space-y-3">
            {/* Channel selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setNotifSettings({...notifSettings, channel: 'telegram'})}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${notifSettings.channel === 'telegram' ? 'bg-[var(--blue-bg)] border-[var(--blue-border)] text-[var(--blue)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
              >
                ✈️ Telegram (Recommended)
              </button>
              <button
                onClick={() => setNotifSettings({...notifSettings, channel: 'whatsapp'})}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${notifSettings.channel === 'whatsapp' ? 'bg-[var(--green-bg)] border-[var(--green-border)] text-[var(--green)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
              >
                📱 WhatsApp
              </button>
            </div>

            {/* Telegram settings */}
            {notifSettings.channel === 'telegram' && (
              <>
                <div>
                  <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">Bot Token</label>
                  <input
                    type="password"
                    placeholder="From @BotFather"
                    value={notifSettings.telegramBotToken}
                    onChange={e => setNotifSettings({...notifSettings, telegramBotToken: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">Chat ID</label>
                  <input
                    type="text"
                    placeholder="Your chat ID (see below)"
                    value={notifSettings.telegramChatId}
                    onChange={e => setNotifSettings({...notifSettings, telegramChatId: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm"
                  />
                </div>
                <div className="p-2 rounded-lg bg-[var(--blue-bg)] text-[10px] text-[var(--blue)]">
                  <b>Setup (30 sec):</b><br/>
                  1. Open Telegram → search <b>@BotFather</b> → send <code>/newbot</code> → get token<br/>
                  2. Open your bot → send any message<br/>
                  3. Get your chat ID: open <code>api.telegram.org/bot[TOKEN]/getUpdates</code><br/>
                  <b>✅ Safe:</b> No phone number shared. Bot is yours. Official Telegram API.
                </div>
              </>
            )}

            {/* WhatsApp settings */}
            {notifSettings.channel === 'whatsapp' && (
              <>
                <div className="p-2 rounded-lg bg-[var(--amber-bg)] text-[10px] text-[var(--amber)]">
                  ⚠️ <b>Use a secondary number only.</b> CallMeBot is a third-party service — don't use your primary bank-linked number.
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">Phone (secondary number)</label>
                  <input
                    type="text"
                    placeholder="91XXXXXXXXXX"
                    value={notifSettings.phone}
                    onChange={e => setNotifSettings({...notifSettings, phone: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">CallMeBot API Key</label>
                  <input
                    type="text"
                    placeholder="Get from CallMeBot"
                    value={notifSettings.apiKey}
                    onChange={e => setNotifSettings({...notifSettings, apiKey: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm"
                  />
                </div>
                <div className="p-2 rounded-lg bg-[var(--blue-bg)] text-[10px] text-[var(--blue)]">
                  <b>Setup:</b> Send <i>"I allow callmebot to send me messages"</i> to <b>+34 644 71 99 23</b> on WhatsApp from your secondary number.
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                ['ipoApplied', '📋 IPO Applied'],
                ['ipoMandatePending', '⚠️ UPI Mandate'],
                ['ipoAllotment', '🎉 IPO Allotment'],
                ['tradeOpened', '📈 Trade Opened'],
                ['tradeClosed', '💰 Trade Closed'],
                ['signalAlert', '🔔 Signal Alert'],
                ['dailySummary', '📊 Daily Summary'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(notifSettings as any)[key]}
                    onChange={e => setNotifSettings({...notifSettings, [key]: e.target.checked})}
                    className="rounded"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  const updated = {...notifSettings, enabled: true};
                  setNotifSettings(updated);
                  saveNotificationSettings(updated);
                }}
                disabled={!notifSettings.phone || !notifSettings.apiKey}
                className="px-4 py-2 rounded-lg bg-[var(--green)] text-white text-xs font-semibold disabled:opacity-40"
              >
                ✓ Enable
              </button>
              {notifSettings.enabled && (
                <button
                  onClick={() => {
                    const updated = {...notifSettings, enabled: false};
                    setNotifSettings(updated);
                    saveNotificationSettings(updated);
                  }}
                  className="px-4 py-2 rounded-lg bg-[var(--red-bg)] text-[var(--red)] text-xs font-semibold"
                >
                  Disable
                </button>
              )}
              <button
                onClick={async () => {
                  setTestStatus('sending');
                  saveNotificationSettings(notifSettings);
                  const ok = await sendTestNotification();
                  setTestStatus(ok ? 'sent' : 'failed');
                  setTimeout(() => setTestStatus('idle'), 3000);
                }}
                disabled={!notifSettings.phone || !notifSettings.apiKey || testStatus === 'sending'}
                className="px-4 py-2 rounded-lg bg-[var(--blue-bg)] text-[var(--blue)] text-xs font-semibold disabled:opacity-40"
              >
                {testStatus === 'sending' ? '⏳ Sending...' : testStatus === 'sent' ? '✓ Sent!' : testStatus === 'failed' ? '✗ Failed' : '📤 Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
