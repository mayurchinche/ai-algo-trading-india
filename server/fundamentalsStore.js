import {backend,check} from './pushBackend.js';
// Newest filings first, so a truncated read keeps the most recent annual comparatives.
export const FUNDAMENTAL_READ_LIMIT=400;
export function fundamentalsStore(db=backend()){return {
 known:async ids=>ids.length?check(await db.from('fundamental_filings').select('id').in('id',ids)):[],
 forInstrument:async key=>check(await db.from('fundamental_filings').select('filing').eq('instrument_key',key).order('published_at',{ascending:false}).limit(FUNDAMENTAL_READ_LIMIT)),
 save:async filing=>check(await db.rpc('record_fundamental_filing',{p_filing:filing})),
};}
