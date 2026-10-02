// Explicit experimental paper assumptions, not a broker tariff or verified margin.
export const segmentPolicy = Object.freeze({
 'short-term':{holdingDays:20,maxPositions:4,riskFraction:.005,allocationFraction:.25,stopFraction:.05,targetFraction:.10},
 'long-term':{holdingDays:180,maxPositions:5,riskFraction:.005,allocationFraction:.20,stopFraction:.10,targetFraction:.25},
 options:{holdingDays:0,maxPositions:2,riskFraction:.005,allocationFraction:.20,stopFraction:.20,targetFraction:.40},
 futures:{holdingDays:0,maxPositions:2,riskFraction:.005,allocationFraction:1,stopFraction:.005,targetFraction:.01},
});
export function segmentFees(segment,entry,exit,quantity){
 // Conservative forward-research allowance. Not invoiced charges. Versioned on every order.
 const rate=segment==='short-term'||segment==='long-term'?.0025:segment==='options'?.002:.0005;
 return Math.round((40+(entry+exit)*quantity*rate)*100)/100;
}
