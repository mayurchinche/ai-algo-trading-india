// Research only: reads the dataset built by research/data/buildBhavDataset.mjs and returns split/bonus-adjusted
// daily bars per company (equity key = ISIN prefix, stable across renames and face-value splits). Prices before an ex-date are multiplied by the product of later price factors (volumes
// divided by it), so returns are continuous across splits and bonuses. Dividends are not adjusted (prices fall by
// the dividend on the ex-date, as a holder sees it before the cash arrives).
// A BREAK is a bar whose prices are not comparable with the previous bar: a rights/demerger/scheme event, a jump
// that looks like a corporate action the feed missed (within 3% of a simple split/bonus ratio and over 25%), or a
// move beyond 3× either way. Real crashes and rallies are NOT breaks: a position held through them takes the move.
// The simulator never holds a position across a break, and strategies must not use indicators spanning one
// (lastBreak gives the latest break at or before each bar).
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
export const ROOT=join(homedir(),'.cache','ai-algo-trading','panel');
const RATIOS=[1/2,1/3,1/4,1/5,1/10,2/3,3/4,2/5,1/1.5].flatMap(r=>[r,1/r]);
export const looksLikeCorporateAction=r=>Math.abs(r-1)>0.25&&(r>3||r<1/3||RATIOS.some(x=>Math.abs(r/x-1)<0.03));
const read=f=>JSON.parse(readFileSync(join(ROOT,f),'utf8'));
export function loadMeta(){
 if(!existsSync(join(ROOT,'index.json')))throw new Error('Dataset missing: run node research/data/buildBhavDataset.mjs');
 return {index:read('index.json'),days:read('days.json'),actions:existsSync(join(ROOT,'actions.json'))?read('actions.json'):{}};
}
// raw: {isin,symbol,d,o,h,l,c,pc,v,val,n}; actions: {factors:{date:f},events:{date:subject}} for this ISIN.
export function adjustSeries(raw,actions={factors:{},events:{}}){
 const n=raw.d.length,mult=new Array(n).fill(1);let m=1;
 for(let i=n-1;i>=0;i--){mult[i]=m;const f=actions.factors?.[raw.d[i]];if(f)m*=f;}
 const o=[],h=[],l=[],c=[],v=[],brk=new Array(n).fill(false);
 for(let i=0;i<n;i++){o.push(raw.o[i]*mult[i]);h.push(raw.h[i]*mult[i]);l.push(raw.l[i]*mult[i]);c.push(raw.c[i]*mult[i]);v.push((raw.v[i]??0)/mult[i]);}
 const explained=[];
 for(let i=1;i<n;i++){
  if(actions.events?.[raw.d[i]]||looksLikeCorporateAction(o[i]/c[i-1]))brk[i]=true;
  if(actions.factors?.[raw.d[i]])explained.push(raw.d[i]);}
 // Index of the latest break at or before each bar, for indicator warm-up checks.
 const lastBreak=new Array(n);let lb=-1;for(let i=0;i<n;i++){if(brk[i])lb=i;lastBreak[i]=lb;}
 return {key:raw.key,isin:raw.isin,symbol:raw.symbol,d:raw.d,o,h,l,c,v,val:raw.val,trades:raw.n,brk,lastBreak,splits:explained};
}
export const loadSeries=(key,meta=loadMeta())=>adjustSeries(read(key+'.json'),meta.actions[key]);
// Every series with at least `minBars` bars, adjusted. ~3,800 series; callers may filter the index first.
export function loadAll({minBars=250,filter=()=>true}={}){
 const meta=loadMeta(),out=[];
 for(const e of meta.index)if(e.bars>=minBars&&filter(e))out.push(loadSeries(e.key,meta));
 return {meta,series:out};
}
