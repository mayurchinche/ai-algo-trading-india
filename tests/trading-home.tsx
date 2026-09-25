// Isolated visual fixture: never reads/writes the user's ledger and makes no market requests.
import {createRoot} from 'react-dom/client';
import {OpportunityCard} from '../src/components/OpportunityCard';
import {TradeTimelineView} from '../src/components/TradeDetailTimeline';
import type {DiscoveredStock} from '../src/services/stockDiscovery';
import '../src/index.css';
const now=Date.parse('2026-09-25T04:16:00Z');
const stock={symbol:'TEST-ONLY',name:'A deliberately long company name for small Android screens',signal:'STRONG_BUY',overallScore:80,eligible:true,ltp:100,generatedAt:'2026-09-25T04:15:00Z',quoteTime:'2026-09-25T04:15:50Z',foAnalysis:{suggestedStopLoss:98,suggestedTarget:104},blockedReasons:[],reasons:['Isolated visual fixture; this is not a trading recommendation.']} as unknown as DiscoveredStock;
export function TradingHomeFixture(){return <main style={{padding:16,maxWidth:1000,margin:'auto'}}><h1>TEST FIXTURE · Synthetic data</h1><p>No storage or trading runtime is connected.</p><div className="opportunity-grid"><OpportunityCard stock={stock} now={now} marketOpen enabled={false} onOpen={()=>{}}/><div className="card"><TradeTimelineView order={{id:'fixture',symbol:'TEST-ONLY',side:'BUY',status:'CLOSED',quantity:10,filled:10,exited:10,entryValue:1000,exitValue:1040,entryPrice:100,exitPrice:104,netPnl:-1.02,fees:41.02,submittedAt:'2026-09-25T04:16:00Z',signalTime:'2026-09-25T04:15:00Z',monitoringGap:true}} events={[{id:1,kind:'SIGNAL_APPROVED',at:'2026-09-25T04:16:00Z'},{id:2,kind:'ENTRY_FILL',at:'2026-09-25T04:16:10Z',quoteTime:'2026-09-25T04:16:08Z',quantity:4,price:100},{id:3,kind:'ENTRY_FILL',at:'2026-09-25T04:16:20Z',quoteTime:'2026-09-25T04:16:18Z',quantity:6,price:100},{id:4,kind:'EXIT_FILL',at:'2026-09-25T04:20:10Z',quoteTime:'2026-09-25T04:20:08Z',quantity:10,price:104},{id:5,kind:'CLOSED',at:'2026-09-25T04:20:10Z',netPnl:-1.02,fees:41.02}]}/></div></div></main>;}
createRoot(document.getElementById('root')!).render(<TradingHomeFixture/>);
