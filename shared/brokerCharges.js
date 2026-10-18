// Broker charges per executed order, itemised as on a contract note. Rates are Zerodha's published NSE tariff
// read on 2026-10-18 (https://zerodha.com/charges). The published transaction rate includes the NSE IPFT levy.
// Contract notes round STT and stamp per note and aggregate by day; per-order accrual can differ by a few paise.
export const TARIFF=Object.freeze({id:'zerodha-nse-published-2026-10-18',source:'https://zerodha.com/charges',readOn:'2026-10-18',exchange:'NSE'});
const RATES=Object.freeze({
 'equity-delivery':{brokerage:()=>0,sttBuy:0.001,sttSell:0.001,txn:0.0000307,stampBuy:0.00015,dpSell:15.34},
 'equity-intraday':{brokerage:v=>Math.min(20,v*0.0003),sttBuy:0,sttSell:0.00025,txn:0.0000307,stampBuy:0.00003,dpSell:0},
 'futures':{brokerage:v=>Math.min(20,v*0.0003),sttBuy:0,sttSell:0.0005,txn:0.0000183,stampBuy:0.00002,dpSell:0},
 // Options: every rate applies to premium turnover. STT on exercised options (0.15% of intrinsic value) is not modelled.
 'options':{brokerage:()=>20,sttBuy:0,sttSell:0.0015,txn:0.0003553,stampBuy:0.00003,dpSell:0},
});
export const PRODUCTS=Object.freeze(Object.keys(RATES));
const SEBI=10/1e7,GST=0.18;
// The product a strategy leg trades under: intraday equity is MIS, positional equity is delivery (CNC).
export function productOf(spec,leg){
 if(leg.instrument.type==='future')return 'futures';
 if(leg.instrument.type==='option')return 'options';
 return spec.mode==='intraday'?'equity-intraday':'equity-delivery';
}
// side: BUY or SELL; value: price × quantity of this executed order (premium value for options).
export function orderCharges(product,side,value){
 const r=RATES[product];
 if(!r)throw new RangeError('Unknown product '+product);
 if(!['BUY','SELL'].includes(side)||!(value>=0)||!Number.isFinite(value))throw new RangeError('Invalid side or value');
 const buy=side==='BUY';
 const items={brokerage:r.brokerage(value),stt:value*(buy?r.sttBuy:r.sttSell),exchange:value*r.txn,sebi:value*SEBI,stamp:buy?value*r.stampBuy:0,dp:buy?0:r.dpSell};
 items.gst=(items.brokerage+items.exchange+items.sebi)*GST;
 return {tariff:TARIFF.id,product,side,value,items,total:Object.values(items).reduce((a,b)=>a+b,0)};
}
