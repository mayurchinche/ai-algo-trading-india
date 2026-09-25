import {useEffect,useRef,useState} from 'react';
import {formatIST} from '../services/tradingTime';
export interface ExecutionSettings {mode:'AUTOMATIC'|'MANUAL';delaySeconds:number}
export interface PaperIntent {signalId:string;symbol:string;side:string;score:number;signalTime:string;observedAt:string;dueAt:string;expiresAt:string;status:string;reason?:string;stop:number;target:number;signalPrice?:number;signalQuoteTime?:string}
type Action=(action:Record<string,unknown>)=>Promise<boolean>;
function ExecutionSettingsForm({settings,disabled,onAction}:{settings:ExecutionSettings;disabled:boolean;onAction:Action}){
 const [mode,setMode]=useState(settings.mode),[delay,setDelay]=useState(settings.delaySeconds);
 return <form className="journal-toolbar" onSubmit={e=>{e.preventDefault();void onAction({execution:{mode,delaySeconds:delay}});}}><label>Order approval<select value={mode} disabled={disabled} onChange={e=>setMode(e.target.value as ExecutionSettings['mode'])}><option value="AUTOMATIC">Automatic</option><option value="MANUAL">Review each signal</option></select></label><label>Automatic reaction delay<select value={delay} disabled={disabled||mode==='MANUAL'} onChange={e=>setDelay(Number(e.target.value))}><option value={0}>No added delay</option><option value={30}>At least 30 seconds</option><option value={60}>At least 60 seconds</option></select></label><button disabled={disabled} type="submit">Save execution settings</button></form>;
}
function SignalTicket({intent,disabled,onAction}:{intent:PaperIntent;disabled:boolean;onAction:Action}){
 const [type,setType]=useState('MARKET'),[quantity,setQuantity]=useState('1'),[price,setPrice]=useState(String(intent.signalPrice||'')),[validity,setValidity]=useState('TTL2');
 const expired=Date.now()>=Date.parse(intent.expiresAt);
 return <form className="paper-ticket" onSubmit={e=>{e.preventDefault();void onAction({reviewIntent:{signalId:intent.signalId,orderType:type,quantity:Number(quantity),validity,...(type==='LIMIT'?{limitPrice:Number(price)}:{}),...(type==='STOP'?{triggerPrice:Number(price)}:{})}});}}>
 <div className="journal-toolbar"><label>Validity<select value={validity} onChange={e=>setValidity(e.target.value)}><option value="TTL2">2-minute expiry</option><option value="DAY">Until 15:15 IST cutoff</option><option value="IOC">First eligible quote only (IOC)</option></select></label><label>Entry order<select value={type} onChange={e=>setType(e.target.value)}><option value="MARKET">Market estimate</option><option value="LIMIT">Limit</option><option value="STOP">Stop entry (market after trigger)</option></select></label><label>Quantity<input type="number" required min="1" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>{type!=='MARKET'&&<label>{type==='LIMIT'?'Limit price (₹)':'Trigger price (₹)'}<input type="number" required min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label>}</div>
 <p>Signal reference ₹{intent.signalPrice??'—'} · Quote: {formatIST(intent.signalQuoteTime)}. This is not a fill price. Funds and risk are checked using a fresh quote at submission.</p>
 <p>Signal stop ₹{intent.stop} · Target ₹{intent.target}. Validity controls the unfilled entry: two minutes, the intraday cutoff, or one eligible quote (IOC). Stop entry with IOC is unsupported. Stop entry is separate from the protective stop.</p>
 <div className="journal-toolbar"><button disabled={disabled||expired} type="submit">{expired?'Signal expired':'Approve paper order'}</button><button disabled={disabled} type="button" onClick={()=>void onAction({reviewIntent:{signalId:intent.signalId,dismiss:true}})}>Dismiss signal</button></div>
 </form>;
}
export function PaperExecutionPanel({settings,intents,disabled,onAction,focusSignalId}:{focusSignalId?:string;settings?:ExecutionSettings;intents:PaperIntent[];disabled:boolean;onAction:Action}){
 const execution=settings||{mode:'AUTOMATIC',delaySeconds:0};
 const [history,setHistory]=useState(false);
 const focused=useRef<HTMLElement|null>(null);
 const focusedIntent=intents.find(i=>i.signalId===focusSignalId);
 const hasFocusedIntent=!!focusedIntent;
 useEffect(()=>{if(hasFocusedIntent)focused.current?.scrollIntoView({block:'start',behavior:'auto'});},[focusSignalId,hasFocusedIntent]);
 const shown=history?[...intents].reverse().slice(0,50):intents.filter(i=>i.signalId===focusSignalId||['REVIEW','WAITING','APPROVED'].includes(i.status)).reverse();
 return <section className="card paper-execution"><h3>Signal → order</h3><ExecutionSettingsForm key={JSON.stringify(execution)} settings={execution} disabled={disabled} onAction={onAction}/><p>Changing settings cancels queued signals; submitted orders keep their original terms. A delay is a minimum: the next foreground scan rechecks the signal, session, quote and funds. Pausing entries cancels queued signals on the next scan.</p><button type="button" aria-pressed={history} onClick={()=>setHistory(!history)}>{history?'Show pending signals':'Show recent decisions'}</button>
 {focusSignalId&&!focusedIntent&&<p role="status">This observation has no paper decision. The scanner must pass session, freshness and account checks before a ticket appears.</p>}
 {!shown.length&&<p role="status">{history?'No signal decisions recorded yet.':'No signals awaiting action. Eligible strong signals appear here while the app is open during market hours.'}</p>}
 {shown.map(i=><article className="paper-intent" key={i.signalId} data-focused={i.signalId===focusSignalId} ref={i.signalId===focusSignalId?focused:undefined}><h4>{i.symbol} · {i.side} · {i.status.replaceAll('_',' ')}</h4><p>Signal {formatIST(i.signalTime)} · Score {i.score}/100</p><p>Review / earliest submission {formatIST(i.dueAt)} · Expires {formatIST(i.expiresAt)}</p>{i.reason&&<p>{i.reason}</p>}{i.status==='REVIEW'&&<SignalTicket intent={i} disabled={disabled} onAction={onAction}/>} {i.status==='APPROVED'&&<p>Approved; waiting for a foreground quote check. Check Orders for submission or recent decisions for rejection.</p>}</article>)}
 {history&&intents.length>50&&<p>Showing the 50 most recent decisions. Full history remains in the ledger export.</p>}
 </section>;
}
