import {useEffect,useState} from 'react';
import {apiUrl} from '../utils/apiUrl';
import {formatIST} from '../services/tradingTime';
import {ReportPassageView,type Report} from './ReportPassages';
type Saved={id:string;created_at:string;report:Report&{symbol:string;fromYear:string;toYear:string}};
export function ReportEvidenceArchive(){
 const [rows,setRows]=useState<Saved[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){setBusy(true);setError('');try{const r=await fetch(apiUrl('/api/report-evidence'));const b=await r.json();if(!r.ok)throw Error(b.error||'Archive unavailable');setRows(b.evidence);}catch(e){setRows([]);setError(e instanceof Error?e.message:'Archive unavailable');}finally{setBusy(false);}}
 useEffect(()=>{void load();const refresh=()=>void load();window.addEventListener('report-evidence-saved',refresh);return ()=>window.removeEventListener('report-evidence-saved',refresh);},[]);
 return <section className="card space-y-3"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">Shared report evidence</h2><button className="rounded-lg border px-3 py-2" disabled={busy} onClick={()=>void load()}>{busy?'Loading archive…':'Refresh archive'}</button></div><p>Shared user1 · up to 200 immutable observations. Saving preserves extracted passages, not the original PDF file. New proposals may capture up to five matching Equity observations. Saving does not change older proposals or verify the findings.</p>{error&&<p role="alert">{error}</p>}{!busy&&!error&&!rows.length&&<p>No report passages have been saved.</p>}{rows.map(row=><details className="border rounded-lg p-3" key={row.id}><summary>{row.report.symbol} · FY {row.report.fromYear}–{row.report.toYear} · Saved {formatIST(row.created_at)}</summary><ReportPassageView report={row.report}/></details>)}</section>;
}
