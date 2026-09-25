export type TradingSegmentId = 'intraday'|'short-term'|'long-term'|'options'|'futures';
export interface TradingSegment {id:TradingSegmentId;label:string;accountId:string;capital:number;executionReady:boolean}
export const tradingSegments: readonly TradingSegment[];
export function tradingSegment(id:unknown): TradingSegment|undefined;
