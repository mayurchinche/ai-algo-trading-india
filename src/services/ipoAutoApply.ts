// ponytail: IPO auto-apply via broker API (Angel One SmartAPI / 5paisa)
// Flow: detect open IPO → submit bid at cut-off → UPI mandate sent → user approves on phone

export interface BrokerConfig {
  broker: 'angel_one' | '5paisa' | 'dhan';
  apiKey: string;
  clientId: string;
  password?: string; // encrypted
  totpSecret?: string; // for Angel One 2FA
  upiId: string; // e.g. "user@upi" — mandate sent here
}

export interface IPOApplication {
  id: string;
  ipoName: string;
  symbol: string;
  bidPrice: number; // cut-off or specific price
  lots: number;
  amount: number;
  upiId: string;
  status: 'PENDING_MANDATE' | 'MANDATE_APPROVED' | 'APPLIED' | 'ALLOTTED' | 'NOT_ALLOTTED' | 'FAILED';
  appliedAt: string; // ISO
  mandateRef?: string;
  error?: string;
}

export interface AutoApplySettings {
  enabled: boolean;
  broker: BrokerConfig | null;
  minScore: number; // Only apply for IPOs with AI score >= this
  maxLots: number;  // Max lots per IPO (1 lot = retail category)
  autoApplyMainboard: boolean;
  autoApplySME: boolean;
  applyAtCutoff: boolean; // true = cut-off price, false = specific price band
}

const SETTINGS_KEY = 'ipo_auto_apply_settings';
const APPLICATIONS_KEY = 'ipo_applications';

// --- Settings Management ---

export function getAutoApplySettings(): AutoApplySettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    enabled: false,
    broker: null,
    minScore: 60, // Only apply for "Apply" or "Strong Apply" rated IPOs
    maxLots: 1,
    autoApplyMainboard: true,
    autoApplySME: false,
    applyAtCutoff: true,
  };
}

export function saveAutoApplySettings(settings: AutoApplySettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// --- Application History ---

export function getIPOApplications(): IPOApplication[] {
  try {
    return JSON.parse(localStorage.getItem(APPLICATIONS_KEY) || '[]');
  } catch { return []; }
}

function saveApplications(apps: IPOApplication[]): void {
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(apps.slice(-50)));
}

// --- Angel One SmartAPI IPO Application ---
// Docs: https://smartapi.angelbroking.com/docs/IPO

async function angelOneLogin(config: BrokerConfig): Promise<string> {
  // ponytail: Angel One requires TOTP-based login to get JWT token
  const res = await fetch('/api/broker/angel/rest/auth/angelbroking/user/v1/loginByPassword', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '127.0.0.1',
      'X-ClientPublicIP': '127.0.0.1',
      'X-MACAddress': '00:00:00:00:00:00',
      'X-PrivateKey': config.apiKey,
    },
    body: JSON.stringify({
      clientcode: config.clientId,
      password: config.password,
      totp: config.totpSecret, // In production, generate TOTP from secret
    }),
  });

  if (!res.ok) throw new Error(`Angel One login failed: ${res.status}`);
  const data = await res.json();
  if (!data.data?.jwtToken) throw new Error(data.message || 'Login failed');
  return data.data.jwtToken;
}

async function angelOneApplyIPO(config: BrokerConfig, params: {
  ipoName: string;
  symbol: string;
  bidPrice: number;
  quantity: number;
}): Promise<{ success: boolean; mandateRef?: string; error?: string }> {
  try {
    const token = await angelOneLogin(config);

    const res = await fetch('/api/broker/angel/rest/secure/angelbroking/ipo/v1/applyIPO', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-PrivateKey': config.apiKey,
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': '127.0.0.1',
        'X-MACAddress': '00:00:00:00:00:00',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
      },
      body: JSON.stringify({
        upiId: config.upiId,
        quantity: params.quantity,
        bidPrice: params.bidPrice,
        activityType: 'new', // new application
        applicationNo: '',
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.message || `HTTP ${res.status}` };
    }

    const data = await res.json();
    if (data.status === true || data.data) {
      return { success: true, mandateRef: data.data?.mandateId || data.data?.applicationNo };
    }
    return { success: false, error: data.message || 'Unknown error' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// --- Main Auto-Apply Logic ---

export async function autoApplyForIPO(ipo: {
  name: string;
  symbol: string;
  price: number; // upper band price
  lotSize: number;
  score: number;
  type: 'mainboard' | 'sme';
}): Promise<IPOApplication | null> {
  const settings = getAutoApplySettings();

  if (!settings.enabled || !settings.broker) return null;
  if (ipo.score < settings.minScore) return null;
  if (ipo.type === 'sme' && !settings.autoApplySME) return null;
  if (ipo.type === 'mainboard' && !settings.autoApplyMainboard) return null;

  const apps = getIPOApplications();
  // Don't re-apply for same IPO
  if (apps.some(a => a.symbol === ipo.symbol && a.status !== 'FAILED')) return null;

  const lots = Math.min(settings.maxLots, 1); // Retail max 1 lot for mainboard
  const quantity = lots * ipo.lotSize;
  const bidPrice = settings.applyAtCutoff ? ipo.price : ipo.price; // cut-off = upper band
  const amount = bidPrice * quantity;

  console.log(`[IPO Auto-Apply] Applying for ${ipo.name}: ${quantity} shares @ ₹${bidPrice} = ₹${amount}`);

  let result: { success: boolean; mandateRef?: string; error?: string };

  if (settings.broker.broker === 'angel_one') {
    result = await angelOneApplyIPO(settings.broker, {
      ipoName: ipo.name,
      symbol: ipo.symbol,
      bidPrice,
      quantity,
    });
  } else {
    // ponytail: other brokers can be added here
    result = { success: false, error: `Broker ${settings.broker.broker} not yet supported for IPO` };
  }

  const application: IPOApplication = {
    id: `${ipo.symbol}-${Date.now()}`,
    ipoName: ipo.name,
    symbol: ipo.symbol,
    bidPrice,
    lots,
    amount,
    upiId: settings.broker.upiId,
    status: result.success ? 'PENDING_MANDATE' : 'FAILED',
    appliedAt: new Date().toISOString(),
    mandateRef: result.mandateRef,
    error: result.error,
  };

  apps.push(application);
  saveApplications(apps);

  if (result.success) {
    console.log(`[IPO Auto-Apply] ✓ ${ipo.name} — UPI mandate sent to ${settings.broker.upiId}. Approve on your phone.`);
  } else {
    console.error(`[IPO Auto-Apply] ✗ ${ipo.name} failed:`, result.error);
  }

  return application;
}

// Clear all applications
export function clearIPOApplications(): void {
  localStorage.removeItem(APPLICATIONS_KEY);
}
