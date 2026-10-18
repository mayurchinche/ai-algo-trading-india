export interface Holding { symbol: string | null; isin: string | null; quantity: number; averagePrice: number | null; lines: number[] }
export interface HoldingsImport {
 holdings: Holding[]; skipped: { line: number; reason: string }[];
 coverage: { rows: number; imported: number; mergedRows: number; skipped: number };
 columns: Record<'symbol' | 'isin' | 'quantity' | 'averagePrice', string | null>; ignoredColumns: string[];
}
export const MAX_CSV_BYTES: number;
export const MAX_ROWS: number;
export const HEADER_ALIASES: Readonly<Record<'symbol' | 'isin' | 'quantity' | 'averagePrice', string[]>>;
export function parseCsv(text: string): { line: number; cells: string[] }[];
export function importHoldingsCsv(text: string): HoldingsImport;
