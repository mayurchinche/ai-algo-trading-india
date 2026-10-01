import {observeOpeningGaps} from '../src/services/openingGap';
import {istMinutes} from '../src/services/tradingTime';
import {discoverStocks,fetchQuotes} from '../src/services/stockDiscovery';
import {SIGNAL_POLICY,strongSignalId,strongSignalRejection} from '../src/services/strongSignalPolicy';
// @ts-expect-error Application-owned provider handler validates allowed hosts and paths.
import marketHandler from '../api/market.js';
async function serverMarketJSON(path:string){
 const provider=path.startsWith('/api/yahoo/')?'yahoo':path.startsWith('/api/nse/')?'nse':null;
 if(!provider)throw new Error('Unsupported server market path');
 let code=200,body:any;
 await marketHandler({method:'GET',headers:{},query:{provider,path:path.slice(('/api/'+provider).length)}},{setHeader(){},status(n:number){code=n;return this;},json(data:unknown){body=data;return this;}});
 if(code!==200)throw new Error('Market provider unavailable');
 return body;
}
export async function observeSharedPaper(account:any){
 const status=await serverMarketJSON('/api/nse/api/marketStatus');
 const market=status.marketState?.find((m:any)=>['Capital Market','CM'].includes(m.market));
 if(typeof market?.marketStatus!=='string')throw new Error('Market status missing');
 const marketOpen=market.marketStatus.trim().toLowerCase()==='open';
 let stocks:Awaited<ReturnType<typeof discoverStocks>>=[];
 let discoveryError:string|undefined;
 let coverage:import('../src/services/stockDiscovery').DiscoveryDiagnostics|undefined;
 if(marketOpen)try{stocks=await discoverStocks(serverMarketJSON,value=>{coverage=value;});}catch{discoveryError='Opportunity scan unavailable; no new candidates. Existing positions still checked.';}
 const now=Date.now();
 const rejections:Record<string,number>={};
 for(const stock of stocks){const reason=strongSignalRejection(stock,now)||'ADMITTED';rejections[reason]=(rejections[reason]||0)+1;}
 const scanDiagnostics={coverage,scored:stocks.length,rejections,maxAbsoluteScore:stocks.length?Math.max(...stocks.map(s=>Math.abs(s.overallScore))):null,watchlist:stocks.slice(0,8).map(s=>({symbol:s.symbol,score:s.overallScore,quoteTime:s.quoteTime,reason:strongSignalRejection(s,now)||'ADMITTED',blockedReasons:s.blockedReasons}))};
 const candidates=stocks.filter(s=>!strongSignalRejection(s,now)).map(s=>({symbol:s.symbol,signalId:strongSignalId(s,now),signalTime:s.generatedAt,side:s.overallScore>0?'BUY':'SELL',score:s.overallScore,stop:s.foAnalysis.suggestedStopLoss,target:s.foAnalysis.suggestedTarget,signalPrice:s.ltp,signalQuoteTime:s.quoteTime,strategy:{id:SIGNAL_POLICY,score:s.overallScore,signal:s.signal,reasons:s.reasons,components:s.scores,strategies:s.strategies,recordedAt:s.generatedAt}}));
 const active=account.state.orders.filter((o:any)=>!['CLOSED','CANCELLED'].includes(o.status)).map((o:any)=>o.symbol);
 const symbols=[...new Set<string>([...active,...(account.state.intents||[]).filter((i:any)=>['REVIEW','WAITING','APPROVED'].includes(i.status)).map((i:any)=>i.symbol),...candidates.map(c=>c.symbol)])];
 const [quotes,gapWatch]=await Promise.all([fetchQuotes(symbols,serverMarketJSON),marketOpen&&istMinutes(now)<630?observeOpeningGaps(stocks,serverMarketJSON,now):Promise.resolve(undefined)]);
 return {marketOpen,discoveryError,scanDiagnostics,gapWatch,candidates,quotes:[...quotes].map(([symbol,q])=>({symbol,...q})),missingQuotes:symbols.filter(s=>!quotes.has(s))};
}
