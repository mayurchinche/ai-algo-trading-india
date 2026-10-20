// NSE capital-market (CM) trading holidays, from the exchange's holiday master
// (https://www.nseindia.com/api/holiday-master?type=trading, "CM" list), read on 20 Oct 2026.
// Only weekday holidays are listed; weekends are never sessions. Special sessions (e.g. Muhurat trading on a
// weekend) are not modelled. Years not listed here fall back to weekdays only: add each year once NSE
// publishes its list.
export const NSE_HOLIDAYS=Object.freeze({
 2026:Object.freeze(['2026-01-15','2026-01-26','2026-03-03','2026-03-26','2026-03-31','2026-04-03','2026-04-14','2026-05-01','2026-05-28','2026-06-26','2026-09-14','2026-10-02','2026-10-20','2026-11-10','2026-11-24','2026-12-25']),
});
const holidays=new Set(Object.values(NSE_HOLIDAYS).flat());
// date: 'YYYY-MM-DD' (IST calendar day).
export function isNseTradingDay(date){
 const day=new Date(date+'T00:00:00Z').getUTCDay();
 return day!==0&&day!==6&&!holidays.has(date);
}
const step=(date,dir)=>{let d=Date.parse(date+'T00:00:00Z');while(!isNseTradingDay(new Date(d).toISOString().slice(0,10)))d+=dir*86400000;return new Date(d).toISOString().slice(0,10);};
// The first trading day on or after date ('YYYY-MM-DD').
export const nextNseTradingDay=date=>step(date,1);
// The last trading day strictly before date ('YYYY-MM-DD').
export const previousNseTradingDay=date=>step(new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10),-1);
