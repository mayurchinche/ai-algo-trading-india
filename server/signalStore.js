import {backend,check} from './pushBackend.js';
export function signalStore(db=backend()){return {
 validations:async()=>check(await db.from('strategy_validations').select('strategy_id,symbol,verdict,computed_at,record').limit(2000)),
 saveValidations:async rows=>check(await db.rpc('save_strategy_validations',{p_rows:rows})),
 signals:async(limit=200)=>check(await db.from('strategy_signals').select('id,recorded_at,signal').order('recorded_at',{ascending:false}).limit(limit)),
 signal:async id=>check(await db.from('strategy_signals').select('id,recorded_at,signal').eq('id',id).maybeSingle()),
 recordSignals:async rows=>check(await db.rpc('record_strategy_signals',{p_rows:rows})),
 recordMarketDay:async(deals,flows)=>check(await db.rpc('record_market_day',{p_deals:deals,p_flows:flows})),
 dealsFor:async(symbol,since)=>check(await db.from('market_deals').select('trade_date,kind,client,side,quantity,price').eq('symbol',symbol).gte('trade_date',since).order('trade_date',{ascending:false}).limit(200)),
 flows:async(limit=20)=>check(await db.from('market_flows').select('trade_date,category,buy_value,sell_value,net_value').order('trade_date',{ascending:false}).limit(limit)),
};}
