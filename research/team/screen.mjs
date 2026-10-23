// node research/team/screen.mjs [--shard i/n] [--only A,B] [--merge]   Screens the 164-strategy library on the DEV window only.
// Each result is a fixed-parameter, causality-audited run; --merge counts them all in the ledger (one variant each) and ranks.
import {readdirSync,writeFileSync,readFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {loadAll} from '../lib/panel.mjs';
import {simulate,report} from '../lib/portfolioSim.mjs';
import {NAMES,makeStrategy,setContext} from '../strategies/megacellar164.mjs';
import {WINDOWS,STATE,readLedger,writeLedger,variantCount,truncate,causalityAudit,tStat} from './gates.mjs';
const arg=k=>{const i=process.argv.indexOf(k);return i<0?null:process.argv[i+1];},CFG=arg('--cfg')||'A',CFGS={A:{},B:{stopPct:12,maxDays:20}},DIR=join(STATE,CFG==='A'?'screen':'screen-'+CFG);mkdirSync(DIR,{recursive:true});
const gross=r=>r.trades.length?+(r.trades.reduce((a,t)=>a+(t.exit/t.entry-1)*100,0)/r.trades.length).toFixed(2):0;
const brief=r=>r&&{avg:+r.avgMonthPct.toFixed(2),worst:+r.worstMonthPct.toFixed(1),pos:+r.positiveMonthsPct.toFixed(0),dd:+r.maxDrawdownPct.toFixed(1),trades:r.trades,win:r.winRatePct&&+r.winRatePct.toFixed(0)};
if(process.argv.includes('--merge')){
 const rows=readdirSync(DIR).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(join(DIR,f),'utf8'))),l=readLedger(),done=new Set(l.variants.map(v=>v.id));
 for(const r of rows)if(!done.has(r.id+(CFG==='A'?'':'_'+CFG)))l.variants.push({id:r.id+(CFG==='A'?'':'_'+CFG),at:r.at,round:0,stage:'screen'+CFG,pass:false,t:r.t});
 const n=variantCount(l);let need=0;
 rows.sort((a,b)=>b.train.avg-a.train.avg);
 const pass=rows.filter(r=>r.audit&&r.train.avg>0&&r.valid.avg>0&&r.valid.worst>=-4&&r.valid.dd>=-10&&r.valid.pos>=70&&r.t>=(need=Math.sqrt(2*Math.log(n*20))));
 for(const r of l.variants)if(pass.some(p=>p.id+(CFG==='A'?'':'_'+CFG)===r.id))r.pass=true;writeLedger(l);
 const f=r=>`${r.id.padEnd(40)} train ${String(r.train.avg).padStart(6)} | valid avg ${String(r.valid.avg).padStart(6)} worst ${String(r.valid.worst).padStart(6)} pos ${String(r.valid.pos).padStart(3)}% dd ${String(r.valid.dd).padStart(6)} | gross/trade ${r.gross}% | t ${r.t}${r.audit?'':' LOOKAHEAD'}`;
 console.log(`variants ${n}, required t ${need.toFixed(2)}, screened ${rows.length}\n--- PASS (${pass.length})\n${pass.map(f).join('\n')}\n--- top 20 by TRAIN avg month (pre-declared shortlist rule)\n${rows.slice(0,20).map(f).join('\n')}\n--- top 10 by valid avg\n${[...rows].sort((a,b)=>b.valid.avg-a.valid.avg).slice(0,10).map(f).join('\n')}\n--- look-ahead failures: ${rows.filter(r=>!r.audit).map(r=>r.id).join(', ')||'none'}`);
 writeFileSync(join(STATE,'screen-ranking-'+CFG+'.json'),JSON.stringify(rows,null,1));process.exit(0);}
const [si,sn]=(arg('--shard')||'0/1').split('/').map(Number),only=arg('--only')?.split(',');
const names=(only||NAMES).filter((_,i)=>only||i%sn===si),dev=truncate(loadAll({minBars:250}),WINDOWS.devEnd);setContext(dev);
for(const name of names){
 if(existsSync(join(DIR,name+'.json'))&&!only)continue;
 const t0=Date.now(),st=makeStrategy(name,{...CFGS[CFG],id:CFG==='A'?name:name+'_'+CFG}),au=causalityAudit(st,dev,{symbols:20,cuts:[.5]}),at=new Date().toISOString();
 if(!au.ok){writeFileSync(join(DIR,name+'.json'),JSON.stringify({id:name,at,audit:false,note:au,train:{avg:-99},valid:{avg:-99},t:0}));console.log(name,'LOOKAHEAD',au.symbol);continue;}
 const run=simulate(st,dev),tr=report(run,WINDOWS.devStart,WINDOWS.trainEnd),va=report(run,'2022-01-01',WINDOWS.devEnd),all=report(run,WINDOWS.devStart,WINDOWS.devEnd);
 writeFileSync(join(DIR,name+'.json'),JSON.stringify({id:name,at,audit:true,train:brief(tr),valid:brief(va),all:brief(all),gross:gross(run),t:+tStat(all).toFixed(2)}));
 console.log(name,'train',tr.avgMonthPct.toFixed(2),'valid',va.avgMonthPct.toFixed(2),((Date.now()-t0)/1000).toFixed(0)+'s');
}
