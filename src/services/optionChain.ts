import type { OptionChain } from '../../shared/optionChain';
import { apiUrl } from '../utils/apiUrl';
export async function fetchChain(underlying: string, expiry: string, signal?: AbortSignal): Promise<OptionChain> {
 const r = await fetch(apiUrl(`/api/option-chain?underlying=${encodeURIComponent(underlying)}&expiry=${expiry}`), { signal: signal ?? AbortSignal.timeout(30000) });
 const b = await r.json().catch(() => ({ error: 'Option chain service returned a page instead of JSON' }));
 if (!r.ok) throw new Error(`${b.error ?? 'Option chain unavailable'}${b.reason ? ' (' + String(b.reason).replaceAll('_', ' ').toLowerCase() + ')' : ''}`);
 return b as OptionChain;
}
