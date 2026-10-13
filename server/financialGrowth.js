const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const previousYear=s=>{const shifted=String(Number(s.slice(0,4))-1)+s.slice(4);return validDate(shifted)?shifted:null;};
export function compareFinancialGrowth(documents){
 const comparisons=[];let omitted=0;
 for(const d of documents){
  const periods=(d.periods||[]).filter(p=>validDate(p.start)&&validDate(p.end)&&p.start<=p.end&&['Standalone','Consolidated'].includes(p.scope));
  const latest=periods.map(p=>p.end).sort().at(-1);
  for(const p of periods.filter(p=>p.end===latest))for(const key of ['revenue','continuingProfit','totalProfit']){
   if(comparisons.length>=24){omitted++;continue;}
   const prior=periods.filter(q=>q.scope===p.scope&&q.start===previousYear(p.start)&&q.end===previousYear(p.end));
   const currentContexts=periods.filter(q=>q.scope===p.scope&&q.start===p.start&&q.end===p.end);
   const current=(p.metrics||[]).filter(m=>m.key===key),previous=prior.length===1?(prior[0].metrics||[]).filter(m=>m.key===key):[];
   let status='CALCULATED_REQUIRES_REVIEW';
   if(currentContexts.length!==1||prior.length>1)status='AMBIGUOUS_REPORTING_CONTEXT';
   else if(prior.length!==1)status='COMPARABLE_PRIOR_PERIOD_MISSING';
   else if(current.length!==1||previous.length!==1||![current[0],previous[0]].every(m=>m.status==='ISSUER_REPORTED'&&Number.isFinite(m.value)))status='INPUT_UNAVAILABLE_OR_AMBIGUOUS';
   else if(!/^[A-Z]{3}$/.test(current[0].currency||'')||current[0].currency!==previous[0].currency)status='CURRENCY_MISMATCH';
   else if(previous[0].value<=0)status='NON_POSITIVE_BASE';
   const value=status==='CALCULATED_REQUIRES_REVIEW'?(current[0].value/previous[0].value-1)*100:null;
   if(value!==null&&!Number.isFinite(value))status='UNSUPPORTED_NUMERIC_RESULT';
   comparisons.push({documentId:d.id,key,scope:p.scope,currentPeriod:{start:p.start,end:p.end,contextId:p.contextId},priorPeriod:prior.length===1?{start:prior[0].start,end:prior[0].end,contextId:prior[0].contextId}:null,currentValue:current.length===1&&Number.isFinite(current[0].value)?current[0].value:null,priorValue:previous.length===1&&Number.isFinite(previous[0].value)?previous[0].value:null,currency:current.length===1?current[0].currency:null,status,growthPct:status==='CALCULATED_REQUIRES_REVIEW'?value:null});
  }
 }
 return {policy:'comparable-growth-v1',comparisons,omitted,note:'Reported YoY change from comparable periods within the same filing only. No cross-filing revision selection, annualisation, organic-growth attribution or forecast. A positive prior value is required. These calculations do not establish sustainable 25% growth or change allocation eligibility.'};
}
