// Research only (not used by the app): node research/data/buildBhavDataset.mjs [from YYYY-MM-DD] [to YYYY-MM-DD]
// Builds a survivorship-free daily dataset of NSE equities from the official bhavcopy archive:
//   1. downloads one file per weekday (holidays return 404) into ~/.cache/ai-algo-trading/bhav (kept; re-runs
//      download only what is missing);
//   2. keeps series EQ (normal rolling settlement; BE/T2T and others are excluded: no intraday, different rules)
//      of company shares (ISIN INE…);
//   3. groups rows by company equity key = ISIN prefix INxXXXXX01 (issuer + equity security code): stable across
//      symbol renames AND face-value splits, which issue a new ISIN (HDFCBANK INE040A01026 → INE040A01034 on the
//      19 Sep 2019 split); the latest symbol and ISIN are the display identity;
//   4. writes ~/.cache/ai-algo-trading/panel/<KEY>.json with raw (unadjusted) prices, plus index.json (one row
//      per ISIN: symbol, first/last date, bars) and days.json (every trading day, incl. weekend special sessions);
//   5. downloads NSE corporate actions month by month into ~/.cache/ai-algo-trading/ca/YYYY-MM.json and writes
//      panel/actions.json: per ISIN, split/bonus/consolidation price factors and other events (rights, demerger,
//      schemes) by ex-date. The bhavcopy's previous close is NOT adjusted on ex-dates (RELIANCE bonus 28 Oct 2024:
//      prev close 2,655.70, close 1,334.35), so adjustment comes from these actions (research/lib/panel.mjs).
import {mkdirSync,existsSync,readFileSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';
export const ROOT=join(homedir(),'.cache','ai-algo-trading');
const BHAV=join(ROOT,'bhav'),PANEL=join(ROOT,'panel');
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const MON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const UDIFF_FROM='2024-07-08';
const urlFor=d=>d>=UDIFF_FROM?`https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${d.replaceAll('-','')}_F_0000.csv.zip`
 :`https://nsearchives.nseindia.com/content/historical/EQUITIES/${d.slice(0,4)}/${MON[+d.slice(5,7)-1]}/cm${d.slice(8,10)}${MON[+d.slice(5,7)-1]}${d.slice(0,4)}bhav.csv.zip`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchDay(d){
 const file=join(BHAV,d+'.zip'),miss=join(BHAV,d+'.none');
 if(existsSync(file)||existsSync(miss))return;
 for(let k=0;k<4;k++){
  try{const r=await fetch(urlFor(d),{headers:{'User-Agent':UA,Accept:'*/*'},signal:AbortSignal.timeout(30000)});
   if(r.status===404){writeFileSync(miss,'');return;}
   if(!r.ok)throw new Error('HTTP '+r.status);
   const b=Buffer.from(await r.arrayBuffer());if(b[0]!==0x50||b[1]!==0x4b)throw new Error('not a zip');writeFileSync(file,b);return;}
  catch(e){if(k===3)throw new Error(`${d}: ${e.message}`);await sleep(1500*(k+1));}
 }
}
const MONTHS={JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'};
const nseDay=s=>{const m=/^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(String(s??'').trim());return m&&MONTHS[m[2].toUpperCase()]?`${m[3]}-${MONTHS[m[2].toUpperCase()]}-${m[1]}`:null;};
// Price effect of a corporate action subject: {factor} multiplies earlier prices (bonus a:b → b/(a+b); split from X
// to Y → Y/X; consolidation from X to Y → Y/X), {event} for actions with no fixed ratio (rights, demerger,
// scheme, capital reduction), null for dividends, interest and meetings (ignored).
export function priceAction(subject){
 const s=String(subject??'');
 // A subject can combine actions ("Bonus 1:1/Face Value Split ... From Rs 10/- ... To Rs 2/-"): factors multiply.
 if(/rights|demerger|scheme|arrangement|amalgamation|capital reduction|reduction of capital|spin/i.test(s))return {event:true};
 let factor=1,found=false;
 for(const part of s.split(/\/(?=\s*[A-Za-z])/).map(x=>x.trim())){
  const bonus=/bonus\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/i.exec(part);
  if(bonus){const a=+bonus[1],b=+bonus[2];if(!(a>0&&b>0))return {event:true};factor*=b/(a+b);found=true;continue;}
  const fv=/(split|sub-?division|consolidation).*?from\s*(?:rs|re)\.?\s*(\d+(?:\.\d+)?).*?to\s*(?:rs|re)\.?\s*(\d+(?:\.\d+)?)/i.exec(part);
  if(fv){const x=+fv[2],y=+fv[3];if(!(x>0&&y>0))return {event:true};factor*=y/x;found=true;}
 }
 return found?{factor}:null;
}
const num=v=>{const x=Number(String(v??'').trim());return Number.isFinite(x)?x:null;};
// One file → EQ rows {isin, symbol, o,h,l,c, pc (prev close), v (shares), val (₹), n (trades)}.
// Company equity only: INE = shares of an Indian company. ETFs and mutual-fund units (INF), whose fund house shares
// one prefix across many funds, and partly-paid lines (IN9) are excluded.
export const companyKey=isin=>/^INE[A-Z0-9]{9}$/.test(isin??'')?isin.slice(0,9):null;
export function parseBhav(text,date){
 const lines=text.split(/\r?\n/).filter(Boolean),head=lines[0].split(',').map(h=>h.trim()),col=n=>head.indexOf(n);
 const udiff=head.includes('TckrSymb');
 const c=udiff?{sym:col('TckrSymb'),ser:col('SctySrs'),isin:col('ISIN'),o:col('OpnPric'),h:col('HghPric'),l:col('LwPric'),c:col('ClsPric'),pc:col('PrvsClsgPric'),v:col('TtlTradgVol'),val:col('TtlTrfVal'),n:col('TtlNbOfTxsExctd')}
  :{sym:col('SYMBOL'),ser:col('SERIES'),isin:col('ISIN'),o:col('OPEN'),h:col('HIGH'),l:col('LOW'),c:col('CLOSE'),pc:col('PREVCLOSE'),v:col('TOTTRDQTY'),val:col('TOTTRDVAL'),n:col('TOTALTRADES')};
 if(Object.values(c).some(i=>i<0))throw new Error(`${date}: unexpected header`);
 const out=[];
 for(const line of lines.slice(1)){const f=line.split(',');if(f[c.ser]?.trim()!=='EQ')continue;
  const r={isin:f[c.isin]?.trim(),symbol:f[c.sym]?.trim(),o:num(f[c.o]),h:num(f[c.h]),l:num(f[c.l]),c:num(f[c.c]),pc:num(f[c.pc]),v:num(f[c.v]),val:num(f[c.val]),n:num(f[c.n])};
  if(!/^IN[A-Z0-9]{10}$/.test(r.isin??'')||!r.symbol||![r.o,r.h,r.l,r.c,r.pc].every(x=>x>0)||r.l>Math.min(r.o,r.c)||r.h<Math.max(r.o,r.c))continue;
  out.push(r);}
 return out;
}
async function main(){
 const [from='2016-01-01',to=new Date(Date.now()+19800000).toISOString().slice(0,10)]=process.argv.slice(2);
 mkdirSync(BHAV,{recursive:true});mkdirSync(PANEL,{recursive:true});
 // Every calendar day: weekend special sessions (budget days, Muhurat trading) exist; other weekends are 404.
 const days=[];for(let t=Date.parse(from+'T00:00:00Z');t<=Date.parse(to+'T00:00:00Z');t+=86400000)days.push(new Date(t).toISOString().slice(0,10));
 let next=0,done=0;const failed=[];
 await Promise.all(Array.from({length:4},async()=>{while(next<days.length){const d=days[next++];try{await fetchDay(d);}catch(e){failed.push(e.message);}if(++done%250===0)console.log('downloaded',done,'/',days.length);await sleep(150);}}));
 if(failed.length)console.log('FAILED',failed.length,failed.slice(0,5));
 const series=new Map(),trading=[],clashes=[];
 for(const f of readdirSync(BHAV).filter(f=>f.endsWith('.zip')).sort()){const d=f.slice(0,10);if(d<from||d>to)continue;
  const rows=parseBhav(execFileSync('unzip',['-p',join(BHAV,f)],{maxBuffer:64e6}).toString('utf8'),d);if(!rows.length)continue;trading.push(d);
  // Two equity lines of one issuer on the same day (rare): the one with more traded value is kept.
  const byKey=new Map();for(const r of rows){const k=companyKey(r.isin);if(!k)continue;const x=byKey.get(k);if(x){clashes.push(`${d} ${x.symbol}/${r.symbol}`);if((x.val??0)>=(r.val??0))continue;}byKey.set(k,r);}
  for(const [key,r] of byKey){const s=series.get(key)??{key,isin:r.isin,symbol:r.symbol,isins:[],d:[],o:[],h:[],l:[],c:[],pc:[],v:[],val:[],n:[]};s.symbol=r.symbol;s.isin=r.isin;if(!s.isins.includes(r.isin))s.isins.push(r.isin);
   s.d.push(d);for(const k of ['o','h','l','c','pc','v','val','n'])s[k].push(r[k]);series.set(key,s);}}
 if(clashes.length)console.log('same-issuer clashes',clashes.length,clashes.slice(0,5));
 const index=[];
 for(const f of readdirSync(PANEL).filter(f=>/^IN[A-Z0-9]+\.json$/.test(f)))rmSync(join(PANEL,f));
 for(const s of series.values()){writeFileSync(join(PANEL,s.key+'.json'),JSON.stringify(s));index.push({key:s.key,isin:s.isin,isins:s.isins,symbol:s.symbol,first:s.d[0],last:s.d.at(-1),bars:s.d.length});}
 writeFileSync(join(PANEL,'index.json'),JSON.stringify(index));
 // Corporate actions, one request per month.
 const CA=join(ROOT,'ca');mkdirSync(CA,{recursive:true});const months=[];
 for(let y=+from.slice(0,4);y<=+to.slice(0,4);y++)for(let m=1;m<=12;m++){const k=`${y}-${String(m).padStart(2,'0')}`;if(k>=from.slice(0,7)&&k<=to.slice(0,7))months.push(k);}
 for(const k of months){const f=join(CA,k+'.json');if(existsSync(f)&&k<to.slice(0,7))continue;
  const [y,m]=k.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate(),fmt=d=>`${String(d).padStart(2,'0')}-${String(m).padStart(2,'0')}-${y}`;
  for(let t=0;t<4;t++){try{const r=await fetch(`https://www.nseindia.com/api/corporates-corporateActions?index=equities&from_date=${fmt(1)}&to_date=${fmt(last)}`,{headers:{'User-Agent':UA,Accept:'application/json'},signal:AbortSignal.timeout(30000)});
   if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();if(!Array.isArray(j))throw new Error('format');writeFileSync(f,JSON.stringify(j));break;}
   catch(e){if(t===3)console.log('CA FAILED',k,e.message);await sleep(2000*(t+1));}}
  await sleep(250);}
 const actions={};let unknown=0;
 for(const f of readdirSync(CA).filter(f=>f.endsWith('.json'))){for(const a of JSON.parse(readFileSync(join(CA,f),'utf8'))){
  const ex=nseDay(a.exDate),key=companyKey(a.isin);if(!ex||!key||(a.series&&a.series!=='EQ'))continue;const p=priceAction(a.subject);if(!p)continue;
  const x=actions[key]??={factors:{},events:{}};
  // The feed can list one action twice (e.g. under two ISINs of the company): one factor per ex-date and subject.
  x.seen??={};const sk=ex+'|'+String(a.subject).trim();if(x.seen[sk])continue;x.seen[sk]=1;
  if(p.factor){x.factors[ex]=(x.factors[ex]??1)*p.factor;}else{x.events[ex]=String(a.subject).slice(0,120);unknown++;}}}
 for(const x of Object.values(actions))delete x.seen;
 writeFileSync(join(PANEL,'actions.json'),JSON.stringify(actions));
 console.log(`corporate actions: ${Object.values(actions).reduce((a,x)=>a+Object.keys(x.factors).length,0)} price factors, ${unknown} other events, ${Object.keys(actions).length} ISINs`);writeFileSync(join(PANEL,'days.json'),JSON.stringify(trading));
 console.log(`trading days ${trading.length} (${trading[0]} – ${trading.at(-1)}), series ${index.length}, ended before ${trading.at(-1)}: ${index.filter(x=>x.last<trading.at(-1)).length}`);
}
if(import.meta.url===`file://${process.argv[1]}`)await main();
