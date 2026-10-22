import type { AutomationState, AutomationJob } from '../services/specPaper';
import { formatIST } from '../services/tradingTime';

const LABELS: [keyof AutomationState['jobs'], string, string][] = [
 ['paper', 'Paper trading cycle', 'every minute in market hours'],
 ['alerts', 'Alert scanner (strong intraday signals)', 'every minute in market hours'],
 ['aggressive', 'Aggressive paper book (experimental)', 'every minute in market hours'],
 ['dailyScan', 'Daily signal scan', '09:16, 09:31, then :14 and :44 each hour (previous close)'],
 ['scan', 'Intraday signal scan', 'every 15 min'],
 ['validate', 'Strategy validation', 'every 5 min until each strategy is fresh (weekly)'],
 ['marketDay', 'Bulk/block deals and FII/DII', '09:16 and 09:31'],
 ['fundamentals', 'NSE financial filings', 'every 30 min'],
 ['outcomes', 'Discover accuracy tracking', 'every 30 min'],
 ['smartMoney', 'Smart money (takeover filings, pledges)', 'every 30 min'],
];
const detail = (j: AutomationJob) => [j.status && j.status.replaceAll('_', ' ').toLowerCase(), j.reason, j.strategy, j.runs !== undefined && `${j.runs} runs${j.outcomes ? ' (' + Object.entries(j.outcomes).map(([k, v]) => `${v} ${k.replaceAll('_', ' ').toLowerCase()}`).join(', ') + ')' : ''}`, j.signals !== undefined && `${j.signals} setups found (${j.active ?? 0} actionable)`, j.validatedPairs !== undefined && `${j.validatedPairs} validated pairs`, j.discoveriesRecorded !== undefined && j.discoveriesRecorded !== null && `${j.discoveriesRecorded} Discover sightings recorded`, j.updated !== undefined && `${j.updated} outcomes updated`, j.candidates !== undefined && `${j.candidates} candidates · ${j.open ?? 0} open · ${j.entries ?? 0} entries · ${j.exits ?? 0} exits`, j.failures ? `${j.failures} failures${j.failureReason ? ' (' + String(j.failureReason).replaceAll('_', ' ').toLowerCase() + ')' : ''}` : null].filter(Boolean).join(' · ');
// Live view of the scheduler: when it last ran and what each automated job did.
export function AutomationStatus({ state, now = Date.now() }: { state: AutomationState | null; now?: number }) {
 const age = state ? (now - Date.parse(state.lastTickAt)) / 60000 : null;
 const live = age !== null && age < 3;
 const failed = state ? LABELS.filter(([k]) => state.jobs[k]?.status === 'FAILED').length : 0;
 // One summary line; the per-job table opens on demand, and opens by itself when a job failed.
 return <details className="card panel-details" aria-label="Automation status" open={failed > 0}>
  <summary><span className={`badge ${failed ? 'badge-red' : live ? 'badge-green' : 'badge-amber'}`}>{failed ? `${failed} job${failed > 1 ? 's' : ''} failed` : live ? 'Automation running' : state ? 'Automation idle' : 'Automation not started'}</span>
   <span className="text-sm muted">{state ? `Last run ${formatIST(state.lastTickAt)} · ${state.ticksToday} runs on ${state.day}${live ? '' : ' · runs every minute 09:15–15:35 IST on trading days'}` : 'The scheduler has not run since this version was deployed. It runs every minute 09:15–15:35 IST on trading days.'}</span></summary>
  {state && <div className="panel-body overflow-x-auto"><table className="data-table text-sm"><tbody>{LABELS.map(([k, label, when]) => { const j = state.jobs[k]; return <tr key={k}><td>{label}<br /><small className="text-[var(--text-muted)]">{when}</small></td><td className="whitespace-nowrap">{j ? formatIST(j.at) : 'not yet'}</td><td className={j?.status === 'FAILED' ? 'text-[var(--red)]' : ''}>{j ? detail(j) || 'done' : '—'}</td></tr>; })}</tbody></table></div>}
 </details>;
}
