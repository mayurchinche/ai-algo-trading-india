import type {GapSnapshot} from '../services/openingGap';
import {formatIST,inSession,istMinutes} from '../services/tradingTime';
export function OpeningGapWatch({snapshot,now=Date.now()}:{snapshot?:GapSnapshot;now?:number}){
 const age=now-Date.parse(snapshot?.at||''),fresh=inSession(now)&&istMinutes(now)<630&&age>=0&&age<=120000;
 return <section className="card space-y-3" aria-label="Opening-gap research"><h3>Opening-gap watch · 09:15–10:30 IST</h3>
 <p>Stocks from the live movers screen. Wait for the complete 09:15–09:20 range, then watch for a completed one-minute candle beyond it in the gap direction.</p>
 <p>Research only · No automatic entries or strong-signal popups. The 1–5% gap filters are unvalidated research settings. Corporate actions can create apparent gaps; verify them before any trade.</p>
 <p>{snapshot?`${fresh?'Latest observation':'Historical / not actionable'} · ${formatIST(snapshot.at)} · ${snapshot.status.replaceAll('_',' ')} · ${snapshot.attempted} sampled from ${snapshot.universe} scored stocks · ${snapshot.failures} unavailable`:'No opening-gap observations recorded yet. The server collects these during the opening window; no historical setups are fabricated.'}</p>
 <div className="opportunity-grid">{snapshot?.rows.map(row=><article className="notice" key={row.symbol}><strong>{row.symbol} · {row.gapPct==null?'Gap unavailable':`${row.gapPct>=0?'+':''}${row.gapPct.toFixed(2)}%`}</strong><p>{row.status.replaceAll('_',' ')}{!fresh?' · historical':''}</p><p>{row.reason}</p>{row.open!=null&&<p>Previous close ₹{row.previousClose.toFixed(2)} → Open ₹{row.open.toFixed(2)}</p>}{row.rangeHigh!=null&&<p>Opening range ₹{row.rangeLow?.toFixed(2)}–₹{row.rangeHigh.toFixed(2)}</p>}<p>Observed: {formatIST(row.observedAt)} · Quote: {formatIST(row.quoteTime)}</p>{row.confirmationTime&&<p>Confirmation candle ended: {formatIST(row.confirmationTime)}</p>}</article>)}</div>
 </section>;
}
