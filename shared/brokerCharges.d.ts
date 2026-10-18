import type { StrategySpec, Leg } from './strategySpec';
export type Product = 'equity-delivery' | 'equity-intraday' | 'futures' | 'options';
export interface OrderCharges { tariff: string; product: Product; side: 'BUY' | 'SELL'; value: number; items: { brokerage: number; stt: number; exchange: number; sebi: number; stamp: number; dp: number; gst: number }; total: number }
export const TARIFF: { id: string; source: string; readOn: string; exchange: string };
export const PRODUCTS: readonly Product[];
export function productOf(spec: Readonly<StrategySpec>, leg: Readonly<Leg>): Product;
export function orderCharges(product: Product, side: 'BUY' | 'SELL', value: number): OrderCharges;
