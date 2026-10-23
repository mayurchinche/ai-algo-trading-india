import test from 'node:test';import assert from 'node:assert/strict';
import {parsePreOpen,gapCandidates,levelsFrom,decideEntries,managePositions,entriesBlocked,newGapBook,runGapFillCycle,gapFillSummary,GAPFILL_VERSION,PREOPEN_URL} from '../server/gapFillBook.js';
import {runAutomationTick} from '../server/automation.js';

const at=(hhmm:string,date='2026-10-26')=>Date.parse(`${date}T${hhmm}:00+05:30`);
const pre=(symbol:string,prev:number,open:number,o:any={})=>({metadata:{symbol,series:'EQ',previousClose:prev,purpose:o.purpose??null},detail:{preOpenMarket:{finalPrice:open,finalQuantity:o.qty??100,lastUpdateTime:o.time??'26-Oct-2026 09:08:59'}}});
const body=(rows:any[])=>JSON.stringify({data:rows});
const bars=(n:number,close=100,volume=2e6)=>Array.from({length:n},(_,i)=>({time:i,open:close,high:close+1,low:close-1,close,volume}));

test('pre-open rows: auction price, 2–6% gap downs, today only, no corporate-action days',()=>{
 const rows=parsePreOpen(body([pre('A',100,96),pre('B',100,93),pre('C',100,99),pre('D',100,97,{purpose:'Bonus 1:1'}),pre('E',100,95,{qty:0}),pre('F',100,96,{time:'23-Oct-2026 09:08:59'}),pre('G',40,38),{metadata:{symbol:'H',series:'BE',previousClose:100},detail:{preOpenMarket:{finalPrice:95,finalQuantity:5}}}]));
 assert.deepEqual(rows.map((r:any)=>r.symbol),['A','B','C','D','F','G'],'unmatched auctions and other series dropped');
 assert.equal(rows[0].updated,'2026-10-26');
 assert.deepEqual(gapCandidates(rows,'2026-10-26').map((c:any)=>[c.symbol,Math.round(c.gapPct)]),[['A',-4]],'B gapped 7%, C 1%, D bonus, F stale, G under ₹50');
 assert.throws(()=>parsePreOpen('{"x":1}'),(e:any)=>e.code==='PREOPEN_FORMAT_CHANGED');
 assert.equal(levelsFrom(bars(150)),null);const l:any=levelsFrom(bars(250));assert.equal(l.sma200,100);assert.equal(l.turnover20,2e8);
});

test('entries: risk 0.5% at a 1.5% stop capped at 25% a position and by cash; both fills recorded',()=>{
 const st:any=newGapBook(0),lv={prevClose:100,sma200:90,turnover20:6e8};
 const cands=['A','B','C','D','E'].map(s=>({symbol:s,key:'K'+s,open:96,prevClose:100,gapPct:-4,levels:lv}));
 cands.push({symbol:'LOW',key:'KL',open:96,prevClose:100,gapPct:-4,levels:{...lv,sma200:110}} as any);
 const quotes=new Map([['KA',{ask:96.5,timestamp:'t'}]]);
 const d=decideEntries(st,{cands,quotes,now:at('09:15')});
 assert.deepEqual(d.entered.map((e:any)=>e.qty),[520,520,520,520,1],'four positions of 25% use the cash; the rest buys what it can, as in the backtest');
 assert.equal(d.rejected.find((r:any)=>r.symbol==='LOW').reason,'Below its 200-day average');
 const a=d.entered[0];assert.equal(a.qty,520,'₹50,000 / ₹96.05');assert.equal(a.auction.entry,96.05);assert.equal(a.auction.stop,94.56);
 assert.equal(a.live.entry,96.55);assert.equal(a.live.lateByPct,0.52);assert.equal(d.entered[1].live.open,false);
 st.positions=d.entered;
 // A stop on the auction leg; then the 15:15 exit of the rest at the bid.
 const ev=managePositions(st,{quotes:new Map([['KA',{dayLow:94.5,bid:95}],['KB',{dayLow:95,bid:97}]]),now:at('11:00')});
 assert.deepEqual(ev.map((e:any)=>[e.name,e.symbol]),[['auction','KA'.slice(1)],['live','A']]);
 assert.equal(st.positions[0].auction.reason,'STOP');assert(st.positions[0].auction.net<0);
 const ex=managePositions(st,{quotes:new Map([['KB',{dayLow:95,bid:97}]]),now:at('15:15')});assert.deepEqual(ex.map((e:any)=>e.symbol),['B']);assert(st.positions[1].auction.netPct>0);
});

test('no entries the day after a 1.5% losing day or after a 4% losing month',()=>{
 const st:any=newGapBook(0);st.days['2026-10-23']={startEquity:200000,auctionNet:-3000};st.months['2026-10']={startEquity:200000,auctionNet:-3000};
 assert.match(entriesBlocked(st,'2026-10-26'),/Daily loss stop/);st.days['2026-10-23'].auctionNet=-1000;assert.equal(entriesBlocked(st,'2026-10-26'),null);
 st.months['2026-10'].auctionNet=-8000;assert.match(entriesBlocked(st,'2026-10-26'),/Monthly loss stop/);
});

test('the cycle decides once at 09:15 from the pre-open page, then manages and exits; the tick runs it',async()=>{
 let saved:any=null,urls:string[]=[];const store={read:async()=>saved?{data:saved,updated_at:'t'}:null,create:async(d:any)=>{saved=d;return 'saved';},save:async(d:any)=>{saved=d;return 'saved';}};
 const fetcher=async(u:string)=>{urls.push(u);return {ok:true,status:200,arrayBuffer:async()=>new TextEncoder().encode(body([pre('INFY',1500,1440),pre('TCS',3000,2990)])).buffer};};
 const rising=bars(260,1400,2e6).map((b,i)=>({...b,close:1300+i*0.6,open:1300+i*0.6,high:1301+i*0.6,low:1299+i*0.6}));
 const market={history:async()=>rising,quotes:async(keys:string[])=>new Map(keys.map(k=>[k,{ask:1442,bid:1441,dayLow:1430,timestamp:'t'}]))};
 const master=async()=>[{segment:'NSE_EQ',instrument_type:'EQ',trading_symbol:'INFY',instrument_key:'NSE_EQ|INE009A01021'},{segment:'NSE_EQ',instrument_type:'EQ',trading_symbol:'TCS',instrument_key:'NSE_EQ|INF000000001'}];
 const r:any=await runGapFillCycle({store,market,master,now:()=>at('09:15'),fetcher:fetcher as any});
 assert.equal(urls[0],PREOPEN_URL);assert.equal(r.decided,true);assert.equal(saved.version,GAPFILL_VERSION);assert.deepEqual(saved.days['2026-10-26'].decision.entered,['INFY']);
 assert.equal(saved.positions[0].auction.entry,1440.72,'auction price + 5 bps');
 const r2:any=await runGapFillCycle({store,market,master,now:()=>at('09:16'),fetcher:fetcher as any});assert.equal(r2.decided,false,'decided once a day');assert.equal(urls.length,1);
 const exit:any=await runGapFillCycle({store,market,master,now:()=>at('15:15'),fetcher:fetcher as any});assert.equal(exit.exits,2);assert.equal(saved.positions.length,0);
 const s:any=gapFillSummary(saved,at('15:16'));assert.equal(s.auction.trades,1);assert.equal(s.live.trades,1);assert.equal(saved.days['2026-10-26'].auctionNet,s.auction.net);
 assert.equal((await runGapFillCycle({store,market,master,now:()=>at('10:00','2026-10-25'),fetcher:fetcher as any})).status,'MARKET_CLOSED');
 const noop=async()=>({status:'OK'});let ran=0;
 const tick:any=await runAutomationTick({now:()=>at('09:15'),paper:noop,validate:noop,scan:noop,marketDay:noop,fundamentals:noop,gapFill:async()=>{ran++;return {status:'SAVED'};},status:async()=>{}});
 assert.equal(ran,1);assert.equal(tick.gapFill.status,'SAVED');
});
