import test from 'node:test';import assert from 'node:assert/strict';
import {parseTakeoverDisclosures,parsePledges,parseEquityList,summariseSmartMoney,readSmartMoney,normaliseName,sastUrl,PLEDGE_URL,EQUITY_LIST_URL,SMART_MONEY_VERSION} from '../server/smartMoney.js';
import {backgroundJob,runAutomationTick} from '../server/automation.js';
import {buildToday} from '../server/todayBoard.js';
import {createTodayHandler} from '../api/_today.js';

const sast=(o:any)=>({acqSaleType:'Acquisition',acquirerName:'A Promoter',acquisitionMode:'Open Market',company:'Alpha Limited',symbol:'ALPHA',noOfShareAcq:'1000',noOfShareSale:'-',promoterType:'Y',totAcqShare:'1.2',totSaleShare:'-',totAftShare:'52.4',acquirerDate:'01-OCT-2026 to 05-OCT-2026',timestamp:'07-Oct-2026 18:20',attachement:'https://nsearchives.nseindia.com/a.zip',...o});
const body=(rows:any[])=>JSON.stringify({data:rows});

test('takeover filings: side, promoter flag and percentages are parsed; repeats and incomplete rows are dropped',()=>{
 const rows=parseTakeoverDisclosures(body([sast({}),sast({}),sast({acqSaleType:'Sale',noOfShareSale:'500',totSaleShare:'0.4',totAftShare:'52',promoterType:'N',acquirerName:'Fund X'}),
  sast({symbol:'bad symbol'}),sast({totAcqShare:'-'}),sast({timestamp:''}),sast({acqSaleType:'Pledge'})]));
 assert.equal(rows.length,2);
 assert.deepEqual(rows[0],{symbol:'ALPHA',company:'Alpha Limited',acquirer:'A Promoter',promoter:true,side:'BUY',mode:'Open Market',shares:1000,changePct:1.2,afterPct:52.4,period:'01-OCT-2026 to 05-OCT-2026',disclosedAt:'2026-10-07T18:20:00+05:30',source:'https://nsearchives.nseindia.com/a.zip'});
 assert.equal(rows[1].side,'SELL');assert.equal(rows[1].promoter,false);assert.equal(rows[1].changePct,0.4);assert.equal(rows[1].shares,500);
 assert.throws(()=>parseTakeoverDisclosures('{"rows":[]}'),(e:any)=>e.code==='DISCLOSURE_FORMAT_CHANGED');
});

test('pledges map full company names to NSE symbols; ambiguous and unlisted names stay unmatched',()=>{
 const list=parseEquityList('SYMBOL,NAME OF COMPANY, SERIES\nALPHA,Alpha Industries Limited,EQ\nTWIN1,Twin Ltd,EQ\nTWIN2,Twin Limited,EQ\n');
 assert.equal(normaliseName('Ajmera Realty & Infra India Ltd.'),normaliseName('AJMERA REALTY AND INFRA INDIA LIMITED'));
 const p=parsePledges(body([{comName:'ALPHA INDUSTRIES LTD',percPromoterShares:'   30.50',percTotShares:' 15.25',percPromoterHolding:'50',shp:'30-Sep-2026',broadcastDt:'22-Oct-2026 16:31:18'},
  {comName:'Twin Limited',percPromoterShares:'10'},{comName:'Gone Limited',percPromoterShares:'5'},{comName:'Alpha Industries Limited',percPromoterShares:''}]),list);
 assert.deepEqual(p.rows,[{symbol:'ALPHA',company:'ALPHA INDUSTRIES LTD',promoterPledgedPct:30.5,totalPledgedPct:15.25,promoterHoldingPct:50,period:'2026-09-30',disclosedAt:'2026-10-22T16:31:00+05:30'}]);
 assert.equal(p.unmatched,2);
 assert.throws(()=>parseEquityList('CODE,NAME\nA,B'),(e:any)=>e.code==='EQUITY_LIST_FORMAT_CHANGED');
});

test('the summary nets open-market trades per stock; transfers between promoters are counted, not netted',()=>{
 const t=(o:any)=>({symbol:'ALPHA',company:'Alpha',acquirer:'P',promoter:true,side:'BUY',mode:'Open Market',changePct:1,afterPct:50,disclosedAt:'2026-10-07T18:20:00+05:30',source:null,...o});
 const s=summariseSmartMoney({takeovers:[t({}),t({changePct:0.5,side:'SELL'}),t({mode:'Inter-se transfer',changePct:8}),t({symbol:'BETA',side:'SELL',changePct:2}),
  t({symbol:'GAMMA',promoter:false,acquirer:'Fund X',changePct:3.25})],pledges:[{symbol:'DELTA',company:'Delta',promoterPledgedPct:60,period:'2026-09-30'},{symbol:'ALPHA',company:'Alpha',promoterPledgedPct:10,period:'2026-09-30'}]});
 assert.deepEqual(s.promoterBuying.map(r=>[r.symbol,r.promoterNetPct,r.promoterBuys,r.promoterSells,r.otherFilings,r.pledgedPct]),[['ALPHA',0.5,1,1,1,10]]);
 assert.deepEqual(s.promoterSelling.map(r=>[r.symbol,r.promoterNetPct]),[['BETA',-2]]);
 assert.deepEqual(s.investorBuying.map(r=>[r.symbol,r.outsiderNetPct,r.outsiders]),[['GAMMA',3.25,['Fund X']]]);
 assert.deepEqual(s.pledged.map(r=>r.symbol),['DELTA']);
 assert.deepEqual(s.flags.ALPHA.map((f:any)=>f.kind),['PROMOTER_BUYING']);assert.equal(s.flags.DELTA[0].text,'60% of promoter shares pledged');
 assert.equal(s.flags.GAMMA[0].text,'Fund X bought 3.25% on the open market');
});

test('a failed source is reported and left out; both failing fails the job',async()=>{
 const now=()=>Date.parse('2026-10-22T18:00:00+05:30'),urls:string[]=[];
 const ok=(t:string)=>({ok:true,status:200,arrayBuffer:async()=>new TextEncoder().encode(t).buffer});
 const fetcher=async(url:string)=>{urls.push(url);if(url===PLEDGE_URL)return {ok:false,status:503};if(url===EQUITY_LIST_URL)return ok('SYMBOL,NAME OF COMPANY\nALPHA,Alpha Limited');return ok(body([sast({})]));};
 const s=await readSmartMoney({now,fetcher:fetcher as any});
 assert.equal(urls[0],sastUrl('22-09-2026','22-10-2026'));assert.equal(s.version,SMART_MONEY_VERSION);assert.equal(s.since,'2026-09-22');
 assert.deepEqual(s.failures,[{source:'pledges',reason:'NSE_UNAVAILABLE'}]);assert.equal(s.takeovers,1);assert.equal(s.pledges,undefined);assert.equal(s.promoterBuying[0].symbol,'ALPHA');
 await assert.rejects(readSmartMoney({now,fetcher:(async()=>({ok:false,status:500})) as any}),(e:any)=>e.code==='NSE_UNAVAILABLE');
});

test('the scheduler collects smart money at :27 and :57 and Today shows it with flags on listed stocks',async()=>{
 const at=Date.parse('2026-10-22T10:27:00+05:30');
 assert.equal(backgroundJob(at),'smart-money');assert.equal(backgroundJob(Date.parse('2026-10-22T10:57:00+05:30')),'smart-money');
 let ran=0;const noop=async()=>({status:'OK'});
 const tick:any=await runAutomationTick({now:()=>at,paper:noop,validate:noop,scan:noop,marketDay:noop,fundamentals:noop,smartMoney:async()=>{ran++;return {status:'SAVED'};},status:async()=>{}});
 assert.equal(ran,1);assert.equal(tick.smartMoney.status,'SAVED');
 const smartMoney={version:SMART_MONEY_VERSION,at:'2026-10-22T04:57:00Z',since:'2026-09-22',failures:[],promoterBuying:[{symbol:'INFY'}],promoterSelling:[],investorBuying:[],pledged:[],flags:{INFY:[{kind:'PROMOTER_BUYING',text:'Promoters bought 1% on the open market'}]}};
 const out:any=buildToday({now:at,discoveries:[{symbol:'INFY',side:'BUY',max_score:70,details:{reasons:[]}}],smartMoney});
 assert.equal(out.items[0].smartMoney[0].kind,'PROMOTER_BUYING');assert.equal(out.smartMoney.flags,undefined);assert.equal(out.smartMoney.promoterBuying[0].symbol,'INFY');
 const res:any={status(c:number){this.code=c;return this;},json(b:any){this.body=b;return this;},setHeader(){}};
 const empty={read:async()=>null},store=()=>({signals:async()=>[],verdicts:async()=>[],latestDeals:async()=>[]});
 await createTodayHandler({signals:store as any,discovery:(()=>({day:async()=>[]})) as any,book:(()=>empty) as any,board:empty as any,status:empty as any,smart:{read:async()=>smartMoney} as any,gap:(()=>empty) as any,now:()=>at})({method:'GET',headers:{host:'x'},query:{}},res);
 assert.equal(res.code,200);assert.equal(res.body.smartMoney.since,'2026-09-22');assert.deepEqual(res.body.unavailable,[]);
 const old:any={...res,code:0};await createTodayHandler({signals:store as any,discovery:(()=>({day:async()=>[]})) as any,book:(()=>empty) as any,board:empty as any,status:empty as any,smart:{read:async()=>({version:'old'})} as any,gap:(()=>empty) as any,now:()=>at})({method:'GET',headers:{host:'x'},query:{}},old);
 assert.equal(old.body.smartMoney,null);
});
