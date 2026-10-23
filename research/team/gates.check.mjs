// Proves the audit catches look-ahead and passes causal rules. node research/team/gates.check.mjs
import assert from 'node:assert';
import {loadAll} from '../lib/panel.mjs';
import {STRATEGIES} from '../strategies/shortTerm.mjs';
import {causalityAudit,truncate,WINDOWS} from './gates.mjs';
const data=truncate(loadAll({minBars:250}),WINDOWS.devEnd);
const leaky={id:'leak',product:'equity-delivery',warmup:5,prepare:s=>s,signal:(s,x,i)=>s.c[i+1]>s.c[i]?{score:1,stop:s.c[i]*.95,maxDays:5}:null};
assert.equal(causalityAudit(leaky,data).ok,false,'leaky strategy must fail');
assert.equal(causalityAudit(STRATEGIES.trend200,data).ok,true,'trend200 must pass');
console.log('gates check ok');
