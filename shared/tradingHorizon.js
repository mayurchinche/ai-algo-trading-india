// The trading segment a strategy spec belongs to. Derivative legs decide first; equity strategies are split by
// mode and by their declared maximum holding period (no declared limit means a long-term holding).
export const SEGMENTS=Object.freeze([
 {id:'intraday',label:'Intraday',horizon:'Same session, squared off before close'},
 {id:'swing',label:'Swing',horizon:'2 to 10 trading days'},
 {id:'short-term',label:'Short term',horizon:'Up to about 3 months'},
 {id:'long-term',label:'Long term',horizon:'Months to years'},
 {id:'futures',label:'Futures',horizon:'Intraday or positional futures'},
 {id:'options',label:'Options',horizon:'Defined-risk option strategies'},
]);
export function segmentOfSpec(spec){
 if(spec.legs.some(l=>l.instrument.type==='option'))return 'options';
 if(spec.legs.some(l=>l.instrument.type==='future'))return 'futures';
 if(spec.mode==='intraday')return 'intraday';
 const d=spec.risk?.maxHoldingDays;
 return d===undefined?'long-term':d<=10?'swing':d<=90?'short-term':'long-term';
}
