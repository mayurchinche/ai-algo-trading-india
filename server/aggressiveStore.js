// The aggressive paper book is one app_data row (service role only). Saves are compare-and-set on updated_at,
// so a slow tick that overlaps the next one loses its write instead of overwriting newer state.
import {backend,check} from './pushBackend.js';
export const BOOK_ROW='aggressive_book';
// Any experimental book kept as one app_data row with compare-and-set saves.
export function bookStore(id,db=backend()){return {
 read:async()=>check(await db.from('app_data').select('data,updated_at').eq('id',id).maybeSingle()),
 create:async data=>{const r=await db.from('app_data').insert({id:id,data,updated_at:new Date().toISOString()});if(r.error?.code==='23505')return 'conflict';check(r);return 'saved';},
 save:async(data,expected)=>(check(await db.from('app_data').update({data,updated_at:new Date().toISOString()}).eq('id',id).eq('updated_at',expected).select('id'))).length?'saved':'conflict',
};}
export const aggressiveStore=(db=backend())=>bookStore(BOOK_ROW,db);
