// node research/team/evaluate.mjs <strategyId> [--holdout] [--round N]
// The only sanctioned way to score a strategy. Dev mode (default): data ends 2024-06-30, causality audit first, every call
// is a counted variant, output includes the live-book baselines on the same window. --holdout (QA only): data to today,
// allowed once per strategy, only if its latest dev run passed and its source file is unchanged, and at most 3 looks in total.
import {readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadAll} from '../lib/panel.mjs';
import {simulate} from '../lib/portfolioSim.mjs';
import {STRATEGIES} from '../strategies/shortTerm.mjs';
import {WINDOWS,STATE,HERE,readLedger,writeLedger,variantCount,truncate,causalityAudit,devVerdict,holdVerdict,sha,MAX_HOLDOUT_LOOKS} from './gates.mjs';
const [id,...flags]=process.argv.slice(2),holdout=flags.includes('--holdout'),round=Number(flags[flags.indexOf('--round')+1])||0;
if(!id){console.error('usage: evaluate.mjs <strategyId> [--holdout] [--round N]');process.exit(2);}
const CAND=join(HERE,'..','strategies','candidates'),SHORT=join(HERE,'..','strategies','shortTerm.mjs');
const all={...STRATEGIES};const files={};for(const k of Object.keys(STRATEGIES))files[k]=SHORT;
for(const f of readdirSync(CAND).filter(f=>f.endsWith('.mjs'))){const s=(await import(pathToFileURL(join(CAND,f)).href+'?'+Date.now())).default;if(s?.id){all[s.id]=s;files[s.id]=join(CAND,f);}}
const strategy=all[id];if(!strategy){console.error('unknown strategy',id,'; known:',Object.keys(all).join(', '));process.exit(2);}
for(const k of ['id','product','warmup','prepare','signal'])if(strategy[k]===undefined){console.error('strategy missing',k);process.exit(2);}
const ledger=readLedger(),fileHash=sha(files[id]),now=new Date().toISOString();
const full=loadAll({minBars:250});
const out={id,mode:holdout?'holdout':'dev',at:now,windows:WINDOWS};
if(holdout){
 const lastDev=[...ledger.variants].reverse().find(v=>v.id===id);
 const refuse=!lastDev?'no dev run recorded':!lastDev.pass?'latest dev run did not pass':lastDev.fileHash!==fileHash?'strategy file changed since its dev run; re-run dev':ledger.holdoutLooks.some(h=>h.id===id)?'holdout already used for this strategy':ledger.holdoutLooks.length>=MAX_HOLDOUT_LOOKS?`holdout budget (${MAX_HOLDOUT_LOOKS} looks) is spent`:null;
 if(refuse){console.log(JSON.stringify({...out,refused:refuse},null,1));process.exit(3);}
 const audit=causalityAudit(strategy,full);if(!audit.ok){console.log(JSON.stringify({...out,refused:'causality audit failed',audit},null,1));process.exit(3);}
 const v=holdVerdict(simulate(strategy,full));
 ledger.holdoutLooks.push({id,at:now,accepted:v.accepted,goal:v.goal,holdout:v.holdout});writeLedger(ledger);
 console.log(JSON.stringify({...out,...v},null,1));process.exit(0);
}
const dev=truncate(full,WINDOWS.devEnd),audit=causalityAudit(strategy,dev);
if(!audit.ok){ledger.variants.push({id,at:now,round,fileHash,pass:false,causality:audit});writeLedger(ledger);console.log(JSON.stringify({...out,pass:false,refused:'causality audit failed',audit},null,1));process.exit(3);}
const n=variantCount(ledger)+1,v=devVerdict(simulate(strategy,dev),n);
// What the live books' best existing rules score on the same window, for the old-vs-new comparison.
const base={};for(const b of ['trend200','gapdown-fill-intraday']){const bv=devVerdict(simulate(all[b],dev),n);base[b]={validate:bv.validate,all:bv.all};}
ledger.variants.push({id,at:now,round,fileHash,pass:v.pass,t:v.t,validate:v.validate});writeLedger(ledger);
mkdirSync(join(STATE,'results'),{recursive:true});
const result={...out,variantNumber:n,causality:audit,...v,baselines:base};
writeFileSync(join(STATE,'results',`${id}.json`),JSON.stringify(result,null,1));
console.log(JSON.stringify(result,null,1));
