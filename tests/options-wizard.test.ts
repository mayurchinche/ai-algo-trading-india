import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {PRESETS,buildWizardSpec,resolveLegs,payoff} from '../shared/optionsWizard.js';
import {normalizeOptionChain} from '../shared/optionChain.js';
import {bsPrice,yearsToExpiry} from '../shared/optionsMath.js';
import {PayoffView} from '../src/components/OptionsWizardPage';
const base={underlying:'NIFTY',kind:'index' as const,expiry:'current-week' as const,lots:1,w:2,g:2};
const near=(a:number,b:number,tol=1e-6)=>assert(Math.abs(a-b)<tol,`${a} != ${b}`);

test('every preset builds a valid spec for index and stock underlyings',()=>{
 for(const preset of Object.keys(PRESETS)){
  const r=buildWizardSpec({...base,preset:preset as any});assert(r.ok,preset+': '+JSON.stringify(!r.ok&&r.issues));
  const s=buildWizardSpec({...base,preset:preset as any,underlying:'INFY',kind:'equity',expiry:'current-month',mode:'positional'});assert(s.ok,preset+' stock: '+JSON.stringify(!s.ok&&s.issues));
 }
 const ic:any=buildWizardSpec({...base,preset:'iron-condor',lots:3,legStopLossPct:40,maxLossAmount:2000});
 assert.deepEqual(ic.spec.legs.map((l:any)=>[l.id,l.side,l.instrument.optionType,l.instrument.strike.steps,l.quantity.lots,l.stopLoss.value]),[['ce_short','SELL','CE',2,3,40],['ce_wing','BUY','CE',4,3,40],['pe_short','SELL','PE',2,3,40],['pe_wing','BUY','PE',4,3,40]]);
 assert.deepEqual(ic.spec.risk,{maxLoss:{unit:'amount',value:2000}});assert.equal(ic.spec.schedule.squareOff,'15:15');
 const cal:any=buildWizardSpec({...base,preset:'calendar'});assert.deepEqual(cal.spec.legs.map((l:any)=>l.instrument.expiry),['current-week','next-week']);
 assert.equal(buildWizardSpec({...base,preset:'calendar',expiry:'next-week'}).ok,false);
 const cc:any=buildWizardSpec({...base,preset:'covered-call'});assert.equal(cc.spec.legs[0].instrument.expiry,'current-month');
 assert.equal(buildWizardSpec({...base,preset:'nope' as any}).ok,false);
});

const now=Date.parse('2026-10-19T04:30:00Z'),spot=25000;
const chainFor=(expiry:string,lot=75)=>{const T=yearsToExpiry(expiry,now);return normalizeOptionChain([24600,24700,24800,24900,25000,25100,25200,25300,25400].map(K=>{const s=(t:'CE'|'PE')=>{const p=bsPrice(t,{S:spot,K,T,r:0.065,q:0,sigma:0.15});return {instrument_key:`NSE_FO|${t}${K}${expiry}`,market_data:{ltp:p,bid_price:p-0.5,ask_price:p+0.5,bid_qty:1,ask_qty:1}};};return {expiry,strike_price:K,underlying_key:'NSE_INDEX|Nifty 50',underlying_spot_price:spot,call_options:s('CE'),put_options:s('PE')};}),{underlying:'NIFTY',underlyingKey:'NSE_INDEX|Nifty 50',observedAt:new Date(now).toISOString()});};
const withLots=(c:any,lot=75)=>({...c,strikes:c.strikes.map((s:any)=>({...s,CE:{...s.CE,lotSize:lot},PE:{...s.PE,lotSize:lot}}))});
const week=withLots(chainFor('2026-10-27')),nextWeek=withLots(chainFor('2026-11-03'));
test('iron condor resolves strikes and has capped profit, capped loss and two breakevens',()=>{
 const spec:any=(buildWizardSpec({...base,preset:'iron-condor'}) as any).spec,legs=resolveLegs(spec,{'current-week':week});
 assert.deepEqual(legs.map(l=>l.strike),[25200,25400,24800,24600]);assert(legs.every(l=>l.status==='RESOLVED'&&l.lotSize===75));
 const p:any=payoff(legs,{spot});assert.equal(p.status,'OK');assert.equal(p.lotSize,'FROM_CHAIN');
 const credit=p.netPremium;assert(credit>0);near(p.maxProfit.value,credit,1e-6);assert.equal(p.maxProfit.status,'WITHIN_RANGE');
 near(p.maxLoss.value,credit-200*75,1e-6);assert.equal(p.maxLoss.status,'WITHIN_RANGE');assert.equal(p.breakevens.length,2);
 near(p.breakevens[1],25200+credit/75,1);near(p.breakevens[0],24800-credit/75,1);
 assert(Math.abs(p.greeks.delta)<10,'near delta-neutral');
});
test('naked short options are unbounded beyond the range; calendars value the far leg with Black-Scholes',()=>{
 const straddle:any=payoff(resolveLegs((buildWizardSpec({...base,preset:'short-straddle'}) as any).spec,{'current-week':week}),{spot});
 assert.equal(straddle.maxLoss.status,'UNBOUNDED_BEYOND_RANGE');assert.equal(straddle.maxProfit.status,'WITHIN_RANGE');
 const cal:any=payoff(resolveLegs((buildWizardSpec({...base,preset:'calendar'}) as any).spec,{'current-week':week,'next-week':nextWeek}),{spot});
 assert.equal(cal.evaluatedAt,'2026-10-27');const peak=cal.curve.reduce((a:any,b:any)=>b.pnl>a.pnl?b:a);assert(Math.abs(peak.price-25000)<200,'calendar peaks near the strike');assert(cal.maxProfit.value>0);
 const missing:any=payoff(resolveLegs((buildWizardSpec({...base,preset:'calendar'}) as any).spec,{'current-week':week}),{spot});assert.equal(missing.status,'UNRESOLVED_LEGS');assert.equal(missing.unresolved[0].status,'NO_CHAIN');
 const cc:any=payoff(resolveLegs((buildWizardSpec({...base,preset:'covered-call'}) as any).spec,{'current-week':week}),{spot});
 assert.equal(cc.maxLoss.status,'UNBOUNDED_BEYOND_RANGE');assert.equal(cc.maxProfit.status,'WITHIN_RANGE');
 const noLot:any=payoff(resolveLegs((buildWizardSpec({...base,preset:'long-straddle'}) as any).spec,{'current-week':chainFor('2026-10-27')}),{spot});assert.equal(noLot.lotSize,'UNKNOWN_PER_UNIT');
 assert.match(renderToStaticMarkup(createElement(PayoffView,{result:straddle})),/unlimited/);
});
