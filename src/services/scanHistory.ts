import type {ScannerState} from '../components/ScannerStatus';
// Days recorded before best-score tracking stay unknown rather than estimated.
export function scanHistorySummary(days:NonNullable<ScannerState['scanDays']>){
 const rows=Object.values(days),recorded=rows.filter(d=>Number.isFinite(d.maxAbsoluteScore));
 return {days:rows.length,checks:rows.reduce((n,d)=>n+d.cycles,0),candidates:rows.reduce((n,d)=>n+d.candidates,0),best:recorded.length?Math.max(...recorded.map(d=>d.maxAbsoluteScore as number)):null,bestDays:recorded.length};
}
