import {advanceWorkflow} from './paperWorkflow.js';
import {newPaperAccount} from './paperEngine.js';
import {evaluatePaperPerformance} from './paperPerformance.js';
export function replayPaper(recording,delaySeconds=60){
 if(recording?.schema!=='paper-observations-v1'||!Array.isArray(recording.cycles)||!recording.cycles.length||!recording.source||![0,30,60].includes(delaySeconds))throw new Error('A nonempty, source-labelled observation recording and supported delay are required');
 if(!Number.isFinite(recording.initialCapital)||recording.initialCapital<=0)throw new Error('Positive initial capital required');
 let state={...newPaperAccount(),capital:recording.initialCapital,execution:{mode:'AUTOMATIC',delaySeconds}},last=-Infinity;const events=[];
 for(const cycle of recording.cycles){
  if(!Number.isFinite(cycle.now)||cycle.now<=last||!Array.isArray(cycle.quotes)||!Array.isArray(cycle.candidates)||typeof cycle.marketOpen!=='boolean'||typeof cycle.acceptEntries!=='boolean')throw new Error('Cycles must be complete and strictly chronological');
  for(const q of cycle.quotes)if(!q.symbol||!q.source||!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(Date.parse(q.timestamp))||Date.parse(q.timestamp)>cycle.now)throw new Error('Invalid or future quote');
  for(const c of cycle.candidates)if(!c.signalId||!Number.isFinite(Date.parse(c.signalTime))||Date.parse(c.signalTime)>cycle.now)throw new Error('Invalid or future signal');
  const result=advanceWorkflow(state,cycle);state=result.state;events.push(...result.events);last=cycle.now;
 }
 return {kind:'execution-replay-not-strategy-backtest',source:recording.source,delaySeconds,
  performance:evaluatePaperPerformance(state),state,events,
  limitations:['Supplied candidates are not regenerated or independently validated against historical scanner inputs.',
   'No interpolation or forced close at recording end; unresolved positions remain open.',
   'Quote arrival, depth and coverage determine execution realism.']};
}
