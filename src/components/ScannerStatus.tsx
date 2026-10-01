import {formatIST,istMinutes,inSession} from '../services/tradingTime';
export interface ScannerState {
 lastCycleAt?:string|null;lastWorkerAttemptAt?:string;marketOpen?:boolean;
 lastScan?:{coverage?:{screenersFailed:number;universe:number;historiesFailed:number;incomplete:number;scored:number};at:string;source:string;status:string;scored?:number;maxAbsoluteScore?:number|null;rejections?:Record<string,number>;watchlist?:{symbol:string;score:number;quoteTime?:string;reason:string;blockedReasons:string[]}[]};
 scanDays?:Record<string,{cycles:number;candidates:number;failures:number;lastStatus:string}>;
}
export function ScannerStatus({state,now=Date.now()}:{state?:ScannerState;now?:number}){
 const scan=state?.lastScan,age=now-Date.parse(scan?.at||''),recent=Number.isFinite(age)&&age>=0&&age<120000;
 const scheduledWindow=inSession(now)||(istMinutes(now)>=930&&istMinutes(now)<=935&&new Date(now+19800000).getUTCDay()>0&&new Date(now+19800000).getUTCDay()<6);
 const workerAge=now-Date.parse(state?.lastWorkerAttemptAt||'');
 return <section className="card space-y-3" aria-label="Paper scanner diagnostics"><h3>Why are there no new trades?</h3>
 <p>{!scan?'No detailed scan evidence yet. The empty ledger cannot distinguish missing monitoring from rejected signals.':!recent?'Last scan is historical; current signal eligibility is unknown.':scan.status==='NO_ELIGIBLE_SIGNALS'?'The latest scan completed, but no signal passed entry rules.':scan.status.replaceAll('_',' ')}</p>
 <p>Last observation: {formatIST(scan?.at)} · Source: {scan?.source||'Not recorded'}</p>
 <p>{!scheduledWindow?'Outside the scheduled 09:15–15:35 IST weekday window. A current heartbeat is not expected.':workerAge>=0&&workerAge<120000?'Background scheduler/worker recently checked in.':'No recent background heartbeat. Check scheduler runs and HTTP responses; this is not proof that no signals qualified.'}</p>
 <p>Background attempt: {formatIST(state?.lastWorkerAttemptAt)}</p>
 {scan?.scored!=null&&<p>{scan.scored} stocks scored · Highest absolute score {scan.maxAbsoluteScore??'Unavailable'}/100 · Entry threshold 70. Scores are not win probabilities.</p>}
 {scan?.coverage&&<p>Feed coverage: {scan.coverage.universe} candidates · {scan.coverage.screenersFailed} failed screeners · {scan.coverage.historiesFailed} failed histories · {scan.coverage.incomplete} incomplete histories. Partial coverage can miss opportunities.</p>}
 {scan?.rejections&&<p>{Object.entries(scan.rejections).map(([reason,count])=>`${reason.replaceAll('_',' ')}: ${count}`).join(' · ')}</p>}
 {!!scan?.watchlist?.length&&<details><summary>Developing setups and rejection reasons</summary><p>Observed candidates, not buy/sell recommendations. These can remain below entry criteria throughout the session.</p>{scan.watchlist.map(s=><div className="notice" key={s.symbol}><strong>{s.symbol} · {s.score}/100</strong><p>{s.reason.replaceAll('_',' ')}{s.blockedReasons.length?` · ${s.blockedReasons.join('; ')}`:''}</p><p>Quote: {formatIST(s.quoteTime)}</p></div>)}</details>}
 {!!state?.scanDays&&<details><summary>Daily scan evidence (last 30 days)</summary>{Object.entries(state.scanDays).sort(([a],[b])=>b.localeCompare(a)).map(([day,d])=><p key={day}>{day} · {d.cycles} checks · {d.candidates} candidate observations · {d.failures} failed scans · {d.lastStatus.replaceAll('_',' ')}</p>)}<p>Repeated observations are not unique signals or executed trades. Dates without evidence remain unknown.</p></details>}
 </section>;
}
