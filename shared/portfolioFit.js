// Portfolio fit against risk-profile limits. A check passes or fails only when the data proves it;
// unpriced holdings or unknown sectors make dependent checks UNKNOWN, never PASS.
export const PORTFOLIO_FIT_VERSION='portfolio-fit-v1';
const pct=(a,b)=>a/b*100;

// holdings: from importHoldingsCsv. prices: Map key→{status:'OBSERVED',close,date}|{status,reason}, keyed by
// symbol. reference: Map key→{symbol,isin,industry?,supportedFiling?,valueScore?} keyed by ISIN and symbol.
export function assessPortfolioFit({holdings,prices,reference,limits}){
 const lookup=h=>(h.isin&&reference.get(h.isin))||(h.symbol&&reference.get(h.symbol))||null;
 const positions=holdings.map(h=>{
  const ref=lookup(h),symbol=h.symbol??ref?.symbol??null,price=symbol?prices.get(symbol)??{status:'NOT_REQUESTED'}:{status:'NO_SYMBOL'};
  const value=price.status==='OBSERVED'?h.quantity*price.close:null;
  return {symbol,isin:h.isin??ref?.isin??null,quantity:h.quantity,averagePrice:h.averagePrice,price,value,costValue:h.averagePrice===null?null:h.quantity*h.averagePrice,
   industry:ref?.industry??null,supportedFiling:ref?.supportedFiling??null,valueScore:ref?.valueScore??null};
 });
 const priced=positions.filter(p=>p.value!==null),unpriced=positions.filter(p=>p.value===null).map(p=>p.symbol??p.isin);
 const total=priced.reduce((a,p)=>a+p.value,0),allPriced=!unpriced.length&&total>0;
 for(const p of positions)p.weightPct=allPriced?pct(p.value,total):null;
 const byWeight=[...priced].sort((a,b)=>b.value-a.value);
 const needsPrices=(id,label,limit,unit)=>({id,label,limit,unit,status:'UNKNOWN',value:null,reason:'UNPRICED_HOLDINGS',unpriced});
 const compare=(id,label,limit,value,unit,extra={})=>({id,label,limit,unit,value,status:value<=limit?'PASS':'BREACH',...extra});
 const checks=[];
 checks.push({id:'holdings',label:'Number of holdings',limit:limits.minHoldings,unit:'count',value:positions.length,status:positions.length>=limits.minHoldings?'PASS':'BREACH'});
 if(!allPriced){checks.push(needsPrices('largestHolding','Largest holding',limits.maxStockPct,'%'),needsPrices('topFive','Top five holdings',limits.maxTopFivePct,'%'),needsPrices('largestSector','Largest sector',limits.maxSectorPct,'%'));}
 else{
  checks.push(compare('largestHolding','Largest holding',limits.maxStockPct,byWeight[0].weightPct,'%',{holding:byWeight[0].symbol}));
  checks.push(compare('topFive','Top five holdings',limits.maxTopFivePct,byWeight.slice(0,5).reduce((a,p)=>a+p.weightPct,0),'%'));
  const sectors=new Map();for(const p of positions)if(p.industry)sectors.set(p.industry,(sectors.get(p.industry)||0)+p.weightPct);
  const unknownPct=positions.filter(p=>!p.industry).reduce((a,p)=>a+p.weightPct,0);
  const [topSector,topPct]=[...sectors].sort((a,b)=>b[1]-a[1])[0]??[null,0];
  // Unclassified holdings could belong to the largest known sector, so a pass needs room for all of them.
  const status=topPct>limits.maxSectorPct?'BREACH':topPct+unknownPct<=limits.maxSectorPct?'PASS':'UNKNOWN';
  checks.push({id:'largestSector',label:'Largest sector',limit:limits.maxSectorPct,unit:'%',value:topPct,sector:topSector,unclassifiedPct:unknownPct,status,...(status==='UNKNOWN'?{reason:'UNCLASSIFIED_HOLDINGS'}:{})});
 }
 // Quality is reported as coverage, not a pass/fail: the scores are research ranks with documented gaps.
 const supportedPct=allPriced?positions.filter(p=>p.supportedFiling).reduce((a,p)=>a+p.weightPct,0):null;
 const scored=allPriced?positions.filter(p=>Number.isFinite(p.valueScore)):[],scoredPct=scored.reduce((a,p)=>a+p.weightPct,0);
 const sectors=allPriced?[...positions.reduce((m,p)=>m.set(p.industry??'Unclassified',(m.get(p.industry??'Unclassified')||0)+p.weightPct),new Map())].map(([industry,weightPct])=>({industry,weightPct})).sort((a,b)=>b.weightPct-a.weightPct):null;
 return {version:PORTFOLIO_FIT_VERSION,status:checks.some(c=>c.status==='BREACH')?'OUTSIDE_LIMITS':checks.some(c=>c.status==='UNKNOWN')?'INCOMPLETE':'WITHIN_LIMITS',
  totals:{marketValue:allPriced?total:null,pricedValue:total,costValue:positions.every(p=>p.costValue!==null)?positions.reduce((a,p)=>a+p.costValue,0):null},
  positions:[...positions].sort((a,b)=>(b.value??-1)-(a.value??-1)||String(a.symbol).localeCompare(String(b.symbol))),checks,sectors,unpriced,
  quality:{supportedFilingPct:supportedPct,valueScoreCoveragePct:allPriced?scoredPct:null,weightedValueScore:scoredPct>0?scored.reduce((a,p)=>a+p.valueScore*p.weightPct,0)/scoredPct:null},
  limitations:['Sectors are NSE industry classifications for NIFTY 50 constituents only; other holdings are unclassified.','Values use the latest completed daily close, not live prices.','Checks cover concentration only: no correlation, liquidity or tax analysis.']};
}
