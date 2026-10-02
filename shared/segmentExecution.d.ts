export const segmentPolicy:Record<string,{holdingDays:number;maxPositions:number;riskFraction:number;allocationFraction:number;stopFraction:number;targetFraction:number}>;
export function segmentFees(segment:string,entry:number,exit:number,quantity:number):number;
