// Round 2: consensus/mix strategies. Members are chosen by TRAIN (2016-11..2021) avg month only (rule fixed before running),
// from the config-B screen. Every strategy here is a counted variant. node research/team/ensembles.mjs
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {loadAll} from '../lib/panel.mjs';
import {simulate} from '../lib/portfolioSim.mjs';
import {makeEnsemble,FILTERS,setContext,NAMES} from '../strategies/megacellar164.mjs';
import {WINDOWS,STATE,readLedger,writeLedger,variantCount,truncate,causalityAudit,devVerdict} from './gates.mjs';
const rank=JSON.parse(readFileSync(join(STATE,'screen-ranking-B.json'),'utf8')).filter(r=>r.audit),byTrain=rank.map(r=>r.id);
const dev=truncate(loadAll({minBars:250}),WINDOWS.devEnd);setContext(dev);
const specs=[
 ['ens-top10-v3',byTrain.slice(0,10),{minVotes:3}],['ens-top5-v2',byTrain.slice(0,5),{minVotes:2}],['ens-top20-v5',byTrain.slice(0,20),{minVotes:5}],
 ['ens-all-v60',NAMES,{minVotes:60}],
 ['ens-top10-v3-mktUp',byTrain.slice(0,10),{minVotes:3,filter:FILTERS.mktUp}],['ens-top10-v3-above200',byTrain.slice(0,10),{minVotes:3,filter:FILTERS.above200}],
 ['ens-top10-v3-both',byTrain.slice(0,10),{minVotes:3,filter:FILTERS.both}],['ens-all-v60-both',NAMES,{minVotes:60,filter:FILTERS.both}],
];
const l=readLedger(),out=[];
for(const [id,names,o] of specs){
 const st=makeEnsemble(names,{...o,id}),au=causalityAudit(st,dev,{symbols:15,cuts:[.5]});if(!au.ok){console.log(id,'LOOKAHEAD');continue;}
 const n=variantCount(l)+1,run=simulate(st,dev),v=devVerdict(run,n);l.variants.push({id,at:new Date().toISOString(),round:2,pass:v.pass,t:v.t,validate:v.validate});
 const g=run.trades.length?run.trades.reduce((a,t)=>a+(t.exit/t.entry-1)*100,0)/run.trades.length:0;
 out.push({id,...v,gross:+g.toFixed(2)});console.log(id.padEnd(26),'pass',v.pass,'| train',v.train?.avgMonthPct,'| valid avg',v.validate?.avgMonthPct,'worst',v.validate?.worstMonthPct,'pos',v.validate?.positiveMonthsPct,'dd',v.validate?.maxDrawdownPct,'| t',v.t,'/',v.requiredT,'| gross/trade',g.toFixed(2),'trades',v.all?.trades);
}
writeLedger(l);writeFileSync(join(STATE,'ensembles.json'),JSON.stringify(out,null,1));
