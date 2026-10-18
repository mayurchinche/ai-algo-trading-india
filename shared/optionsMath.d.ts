export type OptionType = 'CE' | 'PE';
export interface BsInput { S: number; K: number; T: number; r: number; q: number; sigma: number }
export interface Greeks { delta: number; gamma: number; theta: number; vega: number; rho: number }
export const OPTIONS_MATH_VERSION: string;
export function normPdf(x: number): number;
export function normCdf(x: number): number;
export function bsPrice(type: OptionType, p: BsInput): number;
export function bsGreeks(type: OptionType, p: BsInput): Greeks;
export function arbitrageBounds(type: OptionType, p: Omit<BsInput, 'sigma'>): { lower: number; upper: number };
export function impliedVolatility(type: OptionType, price: number, p: Omit<BsInput, 'sigma'>, options?: { low?: number; high?: number; tolerance?: number; maxIterations?: number }): { status: 'SOLVED'; iv: number } | { status: 'INVALID_PRICE' | 'OUTSIDE_ARBITRAGE_BOUNDS' | 'OUTSIDE_SOLVER_RANGE'; iv: null; bounds?: { lower: number; upper: number } };
export function yearsToExpiry(expiryDate: string, now: number): number;
