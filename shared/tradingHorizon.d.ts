import type { StrategySpec } from './strategySpec';
export type SegmentId = 'intraday' | 'swing' | 'short-term' | 'long-term' | 'futures' | 'options';
export const SEGMENTS: readonly { id: SegmentId; label: string; horizon: string }[];
export function segmentOfSpec(spec: StrategySpec): SegmentId;
