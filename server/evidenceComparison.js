import {evidenceHash} from './decisionEvidence.js';
// Offline evaluation of supplied, observed ledger marks. Never generates trades.
// Cash flows occur at the END of each interval, after that interval's return.
export function compareEvidencePolicies({protocol,baseline,challenger}){
 const errors=[];
 const timestamps=protocol?.expectedMarks?.map(Date.parse)||[];
 const start=timestamps[0],end=timestamps.at(-1),frozen=Date.parse(protocol?.frozenAt);
 if(!protocol?.id||!protocol?.dataSnapshotHash||!protocol?.costModel||!protocol?.baselinePolicy||!protocol?.challengerPolicy||protocol.baselinePolicy===protocol.challengerPolicy||!Number.isFinite(frozen)||timestamps.length<2||timestamps.some((t,i)=>!Number.isFinite(t)||i>0&&t<=timestamps[i-1])||!['historical','forward'].includes(protocol.mode)||protocol.cashFlowConvention!=='INTERVAL_END')errors.push('INVALID_COMPARISON_PROTOCOL');
 // Forward selection must predate observation. Historical tests require a frozen
 // protocol before evaluation runs, not fictitious pre-existing knowledge.
 if(protocol?.mode==='forward'&&frozen>start)errors.push('PROTOCOL_FROZEN_AFTER_FORWARD_START');
 if(!Number.isFinite(Date.parse(protocol?.evaluatedAt))||frozen>Date.parse(protocol?.evaluatedAt)||end>Date.parse(protocol?.evaluatedAt))errors.push('INVALID_EVALUATION_TIME');
 function metrics(portfolio,policy,label){
  if(!portfolio||portfolio.policy!==policy||portfolio.costModel!==protocol?.costModel||portfolio.dataSnapshotHash!==protocol?.dataSnapshotHash){errors.push(label+':MISSING_OR_MISMATCHED_LEDGER');return null;}
  if(portfolio.monitoringGaps?.length||portfolio.complete!==true){errors.push(label+':INCOMPLETE_MONITORING');return null;}
  const marks=portfolio.marks;
  if(!Array.isArray(marks)||marks.length!==timestamps.length||marks.some((p,i)=>Date.parse(p.at)!==timestamps[i]||![p.equity,p.netCashFlow,p.grossExposure].every(Number.isFinite)||p.equity<=0||p.grossExposure<0)||marks[0].netCashFlow!==0){errors.push(label+':MISSING_OR_INVALID_MARKS');return null;}
  let index=1,peak=1,drawdown=0,exposure=0;
  for(let i=1;i<marks.length;i++){
   const previous=marks[i-1],point=marks[i],factor=(point.equity-point.netCashFlow)/previous.equity;
   if(factor<=0){errors.push(label+':INVALID_CASH_FLOW_OR_INSOLVENCY');return null;}
   index*=factor;peak=Math.max(peak,index);drawdown=Math.max(drawdown,1-index/peak);
   exposure+=previous.grossExposure/previous.equity*(timestamps[i]-timestamps[i-1]);
  }
  const flows=marks.slice(1).reduce((n,p)=>n+p.netCashFlow,0);
  return {observations:marks.length,netPnl:marks.at(-1).equity-marks[0].equity-flows,netReturnPct:(index-1)*100,observedDrawdownPct:drawdown*100,timeWeightedGrossExposurePct:exposure/(end-start)*100};
 }
 if(errors.length)return {status:'UNAVAILABLE',reasons:errors};
 const a=metrics(baseline,protocol.baselinePolicy,'BASELINE'),b=metrics(challenger,protocol.challengerPolicy,'CHALLENGER');
 if(errors.length)return {status:'UNAVAILABLE',reasons:errors,protocolHash:evidenceHash(protocol)};
 return {status:'COMPARABLE',protocolHash:evidenceHash(protocol),baseline:a,challenger:b,returnDifferencePercentagePoints:b.netReturnPct-a.netReturnPct,limitations:['Metrics use recorded marks only; between-mark drawdowns are unknown.','Gross exposure is last-observed notional divided by equity; it is not broker margin.','A comparison does not establish statistical significance or future profitability.']};
}
