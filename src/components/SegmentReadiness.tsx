import type {TradingSegment} from '../../shared/tradingSegments';
export function SegmentReadiness({segment}:{segment:TradingSegment}){
 const derivative=segment.id==='options'||segment.id==='futures';
 return <section className="notice space-y-3" role="status"><h3>{segment.label}: execution not implemented</h3><p>This is a capability blocker, not a scan reporting zero opportunities. The separate paper balance exists; this segment does not yet generate signals, alerts or fills.</p>
 <ul>{(derivative?['Connect and validate a timestamped contract feed: instrument ID, expiry, lot size, tick size and bid/ask.','Validate contract liquidity and spreads; options also require strike, type and volatility inputs.','Implement contract-level fills, margin checks, expiry/settlement, charges and exits.','Replay unseen historical sessions and verify forward paper results before enabling automatic entries.']:['Validate holding-period signals and overnight risk.','Implement delivery costs, settlement and corporate-action handling.','Verify historical replay and forward paper execution.']).map(item=><li key={item}>{item}</li>)}</ul>
 {derivative&&<p>An equity signal is not an executable {segment.label.toLowerCase()} signal. Free Kite Personal access does not include live or historical market data; a suitable provider must be connected before this gate can pass.</p>}
 </section>;
}
