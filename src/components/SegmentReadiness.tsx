import type {TradingSegment} from '../../shared/tradingSegments';
export function SegmentReadiness({segment}:{segment:TradingSegment}){
 return <section className="notice space-y-3" role="status"><h3>{segment.label}: experimental paper workflow</h3><p>Open Paper trades or Signals for this segment's execution status, observed signals, orders, exits and rejection evidence. The live pilot requires Upstox read-only data and server/database activation.</p><p>This research screen has not yet been adapted to this segment. Strategy replay, corporate-action reconciliation, broker-accurate charges and margin remain separate validation work.</p></section>;
}
