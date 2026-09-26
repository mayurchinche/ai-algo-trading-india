// Research tariff snapshot, checked 2026-09-26. Not a contract-note reconciliation.
export const costModelId='zerodha-nse-cash-intraday-2026-03-v1';
export const tariffSources=['https://zerodha.com/charges','https://nsearchives.nseindia.com/content/circulars/FA73061.pdf','https://support.zerodha.com/category/account-opening/resident-individual/ri-charges/articles/stt-etfs'];
const round=n=>Math.round(n*100)/100;
export function zerodhaIntradayCosts({entry,exit,quantity,side,date,assetType='equity',brokerSquareOff=false}){
 if(![entry,exit,quantity].every(n=>Number.isFinite(n)&&n>0)||!Number.isInteger(quantity)||!['BUY','SELL'].includes(side)||!['equity','equity-etf'].includes(assetType)||typeof date!=='string'||!/^2026-\d{2}-\d{2}$/.test(date)||date<'2026-03-01'||date>'2026-09-26')throw new Error('Unsupported tariff input or date');
 const buy=(side==='BUY'?entry:exit)*quantity,sell=(side==='SELL'?entry:exit)*quantity,turnover=buy+sell;
 const brokerage=Math.min(20,buy*.0003)+Math.min(20,sell*.0003);
 // NSE circular splits the rounded website rate into exchange and IPFT: do not double count.
 const exchange=turnover*306.99/1e7,ipft=turnover*.01/1e7,sebi=turnover*10/1e7;
 const stt=sell*.00025,stamp=buy*.00003,assisted=brokerSquareOff?50:0;
 const gst=(brokerage+exchange+ipft+sebi+assisted)*.18;
 const raw={brokerage,exchange,ipft,sebi,stt,stamp,assisted,gst};
 return {model:costModelId,raw,components:Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,round(v)])),total:round(Object.values(raw).reduce((a,b)=>a+b,0)),rounding:'Accrued per round trip; contract-note STT aggregation/rounding may differ'};
}
export function sizeWithTariff({entry,stop,side,date,riskBudget,cashBudget,maxNotional=5000,maxQuantity=Number.MAX_SAFE_INTEGER,slippageBps=5}){
 if(![entry,stop,riskBudget,cashBudget,maxNotional,maxQuantity,slippageBps].every(Number.isFinite)||entry<=0||stop<=0||riskBudget<=0||cashBudget<=0||maxNotional<=0||maxQuantity<1||slippageBps<0||slippageBps>100)return 0;
 const stopFill=stop*(side==='BUY'?1-slippageBps/10000:1+slippageBps/10000);
 let lo=0,hi=Math.max(0,Math.floor(Math.min(maxQuantity,maxNotional/entry,cashBudget/entry)));
 while(lo<hi){const q=Math.ceil((lo+hi)/2),fees=zerodhaIntradayCosts({entry,exit:stopFill,quantity:q,side,date}).total;
  if(Math.abs(entry-stopFill)*q+fees<=riskBudget&&entry*q+fees<=cashBudget)lo=q;else hi=q-1;
 }
 return lo;
}
