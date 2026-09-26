import {writeFile} from 'node:fs/promises';
import {evaluatePaperPerformance} from '../../server/paperPerformance.js';
import {tradingSegments} from '../../shared/tradingSegments.js';
const [origin,output]=process.argv.slice(2);
if(!origin||!output)throw new Error('Usage: node scripts/research/paper-performance.mjs <origin> <report.json>');
const reports=[];
for(const segment of tradingSegments){
 const response=await fetch(new URL(`/api/shared-paper?segment=${segment.id}`,origin),{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Snapshot unavailable for ${segment.id}: HTTP ${response.status}`);
 const snapshot=await response.json();
 if(snapshot.account?.segment!==segment.id)throw new Error('Wrong account returned');
 reports.push({segment:segment.id,revision:snapshot.account.revision,executionReady:snapshot.account.executionReady,
  ...evaluatePaperPerformance(snapshot.account.state)});
}
// Only write after every account succeeds; failures never become empty results.
await writeFile(output,JSON.stringify({observedAt:new Date().toISOString(),origin,reports},null,2));
console.log(JSON.stringify(reports.map(r=>({segment:r.segment,closed:r.closedOrders,eligible:r.qualified.closedTrades,winRate:r.qualified.winRatePct,netPnl:r.qualified.netPnl,excluded:r.excluded.length})),null,2));
