import {bounded,MarketDataError} from './upstoxReadOnly.js';
// Upstox margin calculator (POST /v2/charges/margin). It returns the margin a broker would block for a basket
// and places no order. This client can call only that URL.
const URL_='https://api.upstox.com/v2/charges/margin';
export function createUpstoxMarginCalculator({fetcher=fetch,token=()=>process.env.UPSTOX_ANALYTICS_TOKEN}={}){
 // items: [{instrumentKey, quantity, side:'BUY'|'SELL', product:'I'|'D'}]
 return async items=>{
  if(!Array.isArray(items)||!items.length||items.length>20)throw new MarketDataError('MARGIN_BASKET_SIZE');
  if(new Set(items.map(i=>i.instrumentKey)).size!==items.length)throw new MarketDataError('MARGIN_DUPLICATE_INSTRUMENT');
  for(const i of items)if(typeof i.instrumentKey!=='string'||!Number.isInteger(i.quantity)||i.quantity<1||!['BUY','SELL'].includes(i.side)||!['I','D'].includes(i.product))throw new MarketDataError('MARGIN_INVALID_ITEM');
  const secret=token();if(!secret)throw new MarketDataError('UPSTOX_TOKEN_MISSING');
  let r;try{r=await fetcher(URL_,{method:'POST',headers:{Authorization:`Bearer ${secret}`,Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({instruments:items.map(i=>({instrument_key:i.instrumentKey,quantity:i.quantity,transaction_type:i.side,product:i.product}))}),redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw new MarketDataError('UPSTOX_TRANSPORT_FAILED');}
  if(!r.ok)throw new MarketDataError(r.status===401||r.status===403?'UPSTOX_AUTH_FAILED':r.status===429?'UPSTOX_RATE_LIMITED':'UPSTOX_MARGIN_FAILED');
  let body;try{body=JSON.parse((await bounded(r,200000)).toString());}catch{throw new MarketDataError('UPSTOX_INVALID_RESPONSE');}
  const d=body?.data,finalMargin=d?.final_margin,required=d?.required_margin;
  if(body?.status!=='success'||!(Number.isFinite(finalMargin)&&finalMargin>=0))throw new MarketDataError('UPSTOX_INVALID_RESPONSE');
  return {status:'OK',required:finalMargin,beforeBenefit:Number.isFinite(required)?required:null,perInstrument:Array.isArray(d.margins)?d.margins:[],source:'UPSTOX_MARGIN_CALCULATOR'};
 };
}
