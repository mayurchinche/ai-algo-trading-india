// Smart money from public NSE disclosures: acquisitions and disposals filed under the takeover rules
// (SEBI SAST Regulation 29, market-wide) and the pledged share of promoter holdings (market-wide snapshot of
// the latest shareholding period). These are filings published after the trades: they show who acted, not what
// happens next, and are shown as context, not as a validated trading rule.
// NSE's insider-trading (PIT) listing is not used: market-wide and dated queries return no rows and the
// per-company listing returns only its 20 oldest-cached rows, often years old.
// Parsers keep only rows whose required fields are present and never fill missing values.
import {nseText,nseDate,csvRows} from './marketIntel.js';
export const SMART_MONEY_VERSION='smart-money-v1';
export const SMART_MONEY_ROW='smart_money';
export const sastUrl=(from,to)=>`https://www.nseindia.com/api/corporate-sast-reg29?index=equities&from_date=${from}&to_date=${to}`;
export const PLEDGE_URL='https://www.nseindia.com/api/corporate-pledgedata?index=equities';
export const EQUITY_LIST_URL='https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv';
const num=v=>{const s=String(v??'').trim();if(!s)return null;const x=Number(s);return Number.isFinite(x)?x:null;};
const SYMBOL=/^[A-Z0-9&-]{1,30}$/;
const r2=v=>Math.round(v*100)/100;
// '22-Oct-2026 21:04' / '22-Oct-2026 16:31:18' → ISO time in IST.
export const nseTime=s=>{const m=/^(\d{2}-[A-Za-z]{3}-\d{4})(?:[ ,]+(\d{2}):(\d{2}))?/.exec(String(s??'').trim());const d=m&&nseDate(m[1]);return d?`${d}T${m[2]??'00'}:${m[3]??'00'}:00+05:30`:null;};
const rowsOf=body=>{const p=JSON.parse(body);if(!Array.isArray(p?.data))throw Object.assign(new Error('format'),{code:'DISCLOSURE_FORMAT_CHANGED'});return p.data;};
// Takeover disclosures; NSE repeats identical filings, so exact repeats are dropped.
export function parseTakeoverDisclosures(body){
 const seen=new Set();
 return rowsOf(body).flatMap(r=>{
  const side=/^acq/i.test(r.acqSaleType??'')?'BUY':/^(sale|dispos)/i.test(r.acqSaleType??'')?'SELL':null,at=nseTime(r.timestamp);
  const changePct=num(side==='BUY'?r.totAcqShare:r.totSaleShare),afterPct=num(r.totAftShare);
  if(!SYMBOL.test(r.symbol??'')||!side||!at||changePct===null||changePct<0)return [];
  const row={symbol:r.symbol,company:String(r.company??'').slice(0,120),acquirer:String(r.acquirerName??'').slice(0,160),promoter:r.promoterType==='Y',side,mode:String(r.acquisitionMode??''),
   shares:num(side==='BUY'?r.noOfShareAcq:r.noOfShareSale),changePct,afterPct,period:String(r.acquirerDate??'').slice(0,40),disclosedAt:at,source:typeof r.attachement==='string'?r.attachement:null};
  const k=[row.symbol,row.acquirer,row.side,row.mode,row.changePct,row.afterPct,row.period].join('|');if(seen.has(k))return [];seen.add(k);
  return [row];
 });
}
// Pledge rows carry company names only. Names map to symbols through NSE's equity list (full registered names) by
// exact normalised name; a name shared by two symbols, or not listed (often suspended), stays unmatched and is counted.
export function parseEquityList(body){
 const [h,...rows]=csvRows(body),si=h.indexOf('SYMBOL'),ni=h.indexOf('NAME OF COMPANY');
 if(si<0||ni<0)throw Object.assign(new Error('header'),{code:'EQUITY_LIST_FORMAT_CHANGED'});
 return rows.filter(r=>SYMBOL.test(r[si]??'')&&r[ni]).map(r=>({symbol:r[si],name:r[ni]}));
}
export const normaliseName=s=>String(s??'').toUpperCase().replace(/&/g,' AND ').replace(/\b(LIMITED|LTD)\b\.?/g,' ').replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export function parsePledges(body,companies){
 const byName=new Map();for(const c of companies){const k=normaliseName(c.name);byName.set(k,byName.has(k)&&byName.get(k)!==c.symbol?null:c.symbol);}
 const rows=[];let unmatched=0;
 for(const r of rowsOf(body)){const pct=num(r.percPromoterShares);if(pct===null||pct<0||pct>100)continue;
  const symbol=byName.get(normaliseName(r.comName));if(!symbol){unmatched++;continue;}
  rows.push({symbol,company:String(r.comName).slice(0,120),promoterPledgedPct:pct,totalPledgedPct:num(r.percTotShares),promoterHoldingPct:num(r.percPromoterHolding),period:nseDate(r.shp),disclosedAt:nseTime(r.broadcastDt)});}
 return {rows,unmatched};
}
const OPEN_MARKET=/^open market$/i;
// Per-symbol summary. Open-market trades are the ones that move a holding at a market price; inter-se transfers
// between promoters, preferential allotments and other modes are counted but not netted.
export function summariseSmartMoney({takeovers=[],pledges=[]},{pledgeWarnPct=25,limit=15}={}){
 const by=new Map(),get=(s,company)=>{if(!by.has(s))by.set(s,{symbol:s,company,promoterNetPct:0,promoterBuys:0,promoterSells:0,outsiderNetPct:0,outsiders:[],otherFilings:0,lastAt:null,pledgedPct:null});return by.get(s);};
 for(const t of takeovers){const x=get(t.symbol,t.company);if(!x.lastAt||t.disclosedAt>x.lastAt){x.lastAt=t.disclosedAt;x.lastSource=t.source;}
  if(!OPEN_MARKET.test(t.mode)){x.otherFilings++;continue;}
  const signed=(t.side==='BUY'?1:-1)*t.changePct;
  if(t.promoter){x.promoterNetPct+=signed;if(t.side==='BUY')x.promoterBuys++;else x.promoterSells++;}
  else{x.outsiderNetPct+=signed;if(!x.outsiders.includes(t.acquirer)&&x.outsiders.length<3)x.outsiders.push(t.acquirer);}}
 for(const p of pledges){const x=get(p.symbol,p.company);x.pledgedPct=p.promoterPledgedPct;x.pledgePeriod=p.period;}
 const rows=[...by.values()].map(x=>({...x,promoterNetPct:r2(x.promoterNetPct),outsiderNetPct:r2(x.outsiderNetPct)}));
 const flags={};for(const x of rows){const f=[];
  if(x.promoterNetPct>0)f.push({kind:'PROMOTER_BUYING',text:`Promoters bought ${x.promoterNetPct}% on the open market`});
  if(x.promoterNetPct<0)f.push({kind:'PROMOTER_SELLING',text:`Promoters sold ${-x.promoterNetPct}% on the open market`});
  if(x.outsiderNetPct>0)f.push({kind:'INVESTOR_BUYING',text:`${x.outsiders.join(', ')} bought ${x.outsiderNetPct}% on the open market`});
  if(x.outsiderNetPct<0)f.push({kind:'INVESTOR_SELLING',text:`${x.outsiders.join(', ')} sold ${-x.outsiderNetPct}% on the open market`});
  if(x.pledgedPct>=pledgeWarnPct)f.push({kind:'PLEDGED',text:`${x.pledgedPct}% of promoter shares pledged`});
  if(f.length)flags[x.symbol]=f;}
 const pick=(f,s)=>rows.filter(f).sort(s).slice(0,limit);
 return {promoterBuying:pick(x=>x.promoterNetPct>0,(a,b)=>b.promoterNetPct-a.promoterNetPct),promoterSelling:pick(x=>x.promoterNetPct<0,(a,b)=>a.promoterNetPct-b.promoterNetPct),
  investorBuying:pick(x=>x.outsiderNetPct>0,(a,b)=>b.outsiderNetPct-a.outsiderNetPct),pledged:pick(x=>x.pledgedPct>=pledgeWarnPct,(a,b)=>b.pledgedPct-a.pledgedPct),flags};
}
const ddmmyyyy=ms=>{const d=new Date(ms+19800000).toISOString().slice(0,10);return `${d.slice(8,10)}-${d.slice(5,7)}-${d.slice(0,4)}`;};
// One snapshot: the last `days` of takeover disclosures and the latest pledge data. Each source is independent;
// a failed source is reported with its reason and its part of the summary is left out, never filled.
export async function readSmartMoney({now,fetcher=fetch,days=30}){
 const at=now(),out={version:SMART_MONEY_VERSION,at:new Date(at).toISOString(),since:new Date(at-days*86400000+19800000).toISOString().slice(0,10),failures:[]};
 const [sast,pledge,list]=await Promise.allSettled([nseText(fetcher,sastUrl(ddmmyyyy(at-days*86400000),ddmmyyyy(at)),8e6),nseText(fetcher,PLEDGE_URL,8e6),nseText(fetcher,EQUITY_LIST_URL,2e6)]);
 let takeovers=[],pledges=[];
 try{if(sast.status==='rejected')throw sast.reason;takeovers=parseTakeoverDisclosures(sast.value);out.takeovers=takeovers.length;}catch(e){out.failures.push({source:'takeovers',reason:e?.code??'UNAVAILABLE'});}
 try{for(const x of [pledge,list])if(x.status==='rejected')throw x.reason;const p=parsePledges(pledge.value,parseEquityList(list.value));pledges=p.rows.filter(r=>r.promoterPledgedPct>0);out.pledges=pledges.length;out.pledgeUnmatched=p.unmatched;}catch(e){out.failures.push({source:'pledges',reason:e?.code??'UNAVAILABLE'});}
 if(out.failures.length===2)throw Object.assign(new Error('no source'),{code:out.failures[0].reason});
 return {...out,...summariseSmartMoney({takeovers,pledges})};
}
