// Research only: node research/data/buildIndexOptions.mjs [from] [to]
// Official NSE F&O bhavcopy (free) → compact daily NIFTY / BANKNIFTY futures and options rows in
// ~/.cache/ai-algo-trading/fo/YYYY-MM-DD.json: [kind F|C|P, symbol, expiry, strike, open, high, low, close, settle, openInterest, volume, underlying].
// End-of-day prices only (no intraday path). Old format to 2024-07-05, UDiFF after (same switch as the equity builder).
import {mkdirSync,existsSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';
const FO=join(homedir(),'.cache','ai-algo-trading','fo');mkdirSync(FO,{recursive:true});
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const MON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'],M={JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'};
const urlFor=d=>d>='2024-07-08'?`https://nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_${d.replaceAll('-','')}_F_0000.csv.zip`
 :`https://nsearchives.nseindia.com/content/historical/DERIVATIVES/${d.slice(0,4)}/${MON[+d.slice(5,7)-1]}/fo${d.slice(8,10)}${MON[+d.slice(5,7)-1]}${d.slice(0,4)}bhav.csv.zip`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),n=v=>Number(v)||0,SYMS=new Set(['NIFTY','BANKNIFTY']);
const oldDate=s=>{const m=/^(\d\d)-([A-Za-z]{3})-(\d{4})$/.exec(s);return m?`${m[3]}-${M[m[2].toUpperCase()]}-${m[1]}`:s;};
function parse(csv){
 const rows=[],lines=csv.split('\n'),h=lines[0].split(',').map(x=>x.trim()),ix=k=>h.indexOf(k),udiff=h.includes('FinInstrmTp');
 const c=udiff?{t:ix('FinInstrmTp'),s:ix('TckrSymb'),e:ix('XpryDt'),k:ix('StrkPric'),o:ix('OptnTp'),op:ix('OpnPric'),hi:ix('HghPric'),lo:ix('LwPric'),cl:ix('ClsPric'),st:ix('SttlmPric'),oi:ix('OpnIntrst'),v:ix('TtlTradgVol'),u:ix('UndrlygPric')}
  :{t:ix('INSTRUMENT'),s:ix('SYMBOL'),e:ix('EXPIRY_DT'),k:ix('STRIKE_PR'),o:ix('OPTION_TYP'),op:ix('OPEN'),hi:ix('HIGH'),lo:ix('LOW'),cl:ix('CLOSE'),st:ix('SETTLE_PR'),oi:ix('OPEN_INT'),v:ix('CONTRACTS'),u:-1};
 for(let i=1;i<lines.length;i++){const f=lines[i].split(',');if(f.length<10||!SYMS.has(f[c.s]))continue;
  const t=f[c.t],kind=t==='FUTIDX'||t==='IDF'?'F':t==='OPTIDX'||t==='IDO'?(f[c.o]==='CE'?'C':'P'):null;if(!kind)continue;
  rows.push([kind,f[c.s],udiff?f[c.e]:oldDate(f[c.e]),n(f[c.k]),n(f[c.op]),n(f[c.hi]),n(f[c.lo]),n(f[c.cl]),n(f[c.st]),n(f[c.oi]),n(f[c.v]),c.u>=0?n(f[c.u]):0]);}
 return rows;
}
async function day(d){
 const file=join(FO,d+'.json');if(existsSync(file))return;
 for(let k=0;k<4;k++){
  try{const r=await fetch(urlFor(d),{headers:{'User-Agent':UA},signal:AbortSignal.timeout(40000)});
   if(r.status===404){writeFileSync(file,'[]');return;}
   if(!r.ok)throw new Error('HTTP '+r.status);
   const b=Buffer.from(await r.arrayBuffer());if(b[0]!==0x50)throw new Error('not a zip');
   const tmp=join(FO,d+'.tmpzip');writeFileSync(tmp,b);let csv;try{csv=execFileSync('unzip',['-p',tmp],{maxBuffer:300e6}).toString('utf8');}finally{rmSync(tmp,{force:true});}
   writeFileSync(file,JSON.stringify(parse(csv,d)));return;}
  catch(e){if(k===3)throw new Error(`${d}: ${e.message}`);await sleep(1500*(k+1));}
 }
}
const from=process.argv[2]??'2016-01-01',to=process.argv[3]??new Date().toISOString().slice(0,10),todo=[];
for(let t=Date.parse(from+'T00:00:00Z');t<=Date.parse(to+'T00:00:00Z');t+=864e5){const d=new Date(t).toISOString().slice(0,10),w=new Date(t).getUTCDay();if(w&&w<6)todo.push(d);}
let next=0,done=0,failed=[];
await Promise.all(Array.from({length:4},async()=>{while(next<todo.length){const d=todo[next++];try{await day(d);}catch(e){failed.push(e.message);}if(++done%200===0)console.log(done,'/',todo.length);}}));
console.log('done',todo.length,'failed',failed.length,failed.slice(0,5));
