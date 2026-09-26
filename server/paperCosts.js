// Existing simulator approximation, not a broker tariff or liquidity guarantee.
const round=n=>Math.round(n*100)/100;
export const paperExecutionFees=(entry,exit,quantity)=>round(40+(entry+exit)*quantity*.0005);
export function estimatePaperEconomics({side,entry,stop,target,quantity},now=Date.now()){
 if(!['BUY','SELL'].includes(side)||![entry,stop,target,quantity].every(n=>Number.isFinite(n)&&n>0)||!Number.isInteger(quantity)||(side==='BUY'?!(stop<entry&&entry<target):!(target<entry&&entry<stop)))return null;
 const direction=side==='BUY'?1:-1,exitFactor=side==='BUY'?.9995:1.0005;
 const targetFill=round(target*exitFactor),stopFill=round(stop*exitFactor);
 const targetCosts=paperExecutionFees(entry,targetFill,quantity),stopCosts=paperExecutionFees(entry,stopFill,quantity);
 const targetNet=round((targetFill-entry)*quantity*direction-targetCosts),stopNet=round((stopFill-entry)*quantity*direction-stopCosts);
 return {model:'paper-costs-v1',at:new Date(now).toISOString(),quantity,entry,targetCosts,stopCosts,targetNet,stopNet,netRewardRisk:stopNet<0?Math.round(targetNet/-stopNet*100)/100:null,costsExceedTarget:targetNet<=0};
}
