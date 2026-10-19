// Themed stacks: short stock lists, each defined by a fixed rule over the NIFTY 50 scorecards. Rules and wording
// are our own. Conditions use peer percentiles (oriented so higher is better, e.g. a high debt/equity percentile
// means less debt) or observed values, never universal valuation cutoffs. The rule text shown to users is
// generated from the same conditions that select members, and every member lists why it qualifies.
export const STACKS_VERSION='theme-stacks-v1';
export const MAX_MEMBERS=10,MIN_MEMBERS=2;

// {metric, by:'percentile'|'value', op:'gte'|'lte', at}
const p=(metric,op,at)=>({metric,by:'percentile',op,at}),v=(metric,op,at)=>({metric,by:'value',op,at});
export const STACKS=Object.freeze([
 {id:'quality-compounders',title:'Quality compounders',thesis:'High returns on capital, modest debt and profit growth at least in line with peers.',conditions:[p('roce','gte',70),p('debtToEquity','gte',50),p('profitGrowth3y','gte',50)]},
 {id:'growth-fair-price',title:'Growth at a fair price',thesis:'Above-peer profit and sales growth without paying the highest price for it.',conditions:[p('profitGrowth3y','gte',60),p('revenueGrowth3y','gte',50),p('peg','gte',60)]},
 {id:'cheap-rising-profit',title:'Cheaper, with rising profit',thesis:'A lower P/E than most peers while last year\'s profit still grew faster than most.',conditions:[p('pe','gte',70),p('profitGrowth1y','gte',50)]},
 {id:'near-high-leaders',title:'Leaders near their highs',thesis:'Strong 12-month price performance and trading close to the 52-week high.',conditions:[p('return12m','gte',70),v('belowHigh','lte',5)],priceSelected:true},
 {id:'quality-out-of-favour',title:'Quality out of favour',thesis:'High return on equity while the share price lagged peers over 12 months. A list to research, not a signal.',conditions:[p('roe','gte',70),p('return12m','lte',30)],priceSelected:true},
 {id:'all-rounders',title:'All-rounders',thesis:'No weak fit in any investing style and a composite score in the top tier.',conditions:[v('score:composite','gte',60)],noWeakStyle:true},
].map(s=>Object.freeze({...s,conditions:Object.freeze(s.conditions.map(Object.freeze))})));

const LABELS={roce:'ROCE',roe:'ROE',debtToEquity:'Debt/equity',pe:'P/E',peg:'PEG',profitGrowth1y:'Profit growth 1y',profitGrowth3y:'Profit CAGR 3y',revenueGrowth3y:'Sales CAGR 3y',return12m:'12-month return',belowHigh:'Below 52-week high','score:composite':'Composite score'};
const UNITS={roce:'%',roe:'%',profitGrowth1y:'%',profitGrowth3y:'%',revenueGrowth3y:'%',return12m:'%',belowHigh:'%'};
const LOWER_IS_BETTER=new Set(['pe','peg','debtToEquity','belowHigh']);
export function conditionText(c){
 const label=LABELS[c.metric]??c.metric,lower=LOWER_IS_BETTER.has(c.metric)?' (lower is better)':'';
 if(c.by==='percentile')return c.op==='gte'?`${label} better than ${c.at}% of peers${lower}`:`${label} worse than ${100-c.at}% of peers${lower}`;
 if(c.metric==='belowHigh')return `within ${c.at}% of the 52-week high`;
 return `${label} ${c.op==='gte'?'at least':'at most'} ${c.at}${UNITS[c.metric]??''}`;
}
export const ruleText=s=>[...s.conditions.map(conditionText),...(s.noWeakStyle?['no style rated a weak fit']:[])].join('; ');

// Percentile of a metric among peers, from the first style that ranked it (every style uses the same peer set).
const percentileOf=(c,metric)=>{for(const s of c.styles??[])for(const k of s.criteria??[])if(k.metric===metric&&k.status==='RANKED'&&Number.isFinite(k.percentile))return k.percentile;return null;};
const valueOf=(c,metric)=>{
 if(metric==='score:composite')return c.composite?.status==='SCORED'&&Number.isFinite(c.composite.score)?c.composite.score:null;
 const m=c.metrics?.[metric];return m&&['CALCULATED_REQUIRES_REVIEW','OBSERVED'].includes(m.status)&&Number.isFinite(m.value)?m.value:null;
};
const fmt=(x,unit='')=>`${Math.abs(x)>=100?x.toFixed(0):x.toFixed(1)}${unit}`;

// A condition holds only on an available value; missing data never qualifies a company.
function check(c,cond){
 const value=valueOf(c,cond.metric),percentile=percentileOf(c,cond.metric);
 const subject=cond.by==='percentile'?percentile:value;
 if(subject===null)return {ok:false};
 const ok=cond.op==='gte'?subject>=cond.at:subject<=cond.at;
 const shown=value===null?'':fmt(value,UNITS[cond.metric]??(cond.metric==='score:composite'?'':'x'));
 const where=percentile===null?'':`better than ${Math.round(percentile)}% of peers`;
 // Filing warnings (e.g. inputs spanning a rename, demerger or ISIN change) travel with the reason.
 return {ok,percentile,why:{metric:cond.metric,label:LABELS[cond.metric]??cond.metric,value,percentile,text:[shown,where].filter(Boolean).join(' · '),warnings:c.metrics?.[cond.metric]?.warnings??[]}};
}

// scorecards: the /api/scorecards result; universe: [{symbol, industry}] for sector labels.
export function buildStacks(scorecards,universe=[]){
 const industry=new Map(universe.map(m=>[m.symbol,m.industry??null]));
 const companies=scorecards?.companies??[];
 const stacks=STACKS.map(stack=>{
  const members=[];
  for(const c of companies){
   const checks=stack.conditions.map(cond=>check(c,cond));
   if(!checks.every(x=>x.ok))continue;
   if(stack.noWeakStyle){const scored=(c.styles??[]).filter(s=>s.status==='SCORED');if(!scored.length||scored.some(s=>s.score<=30))continue;}
   // Rank by the mean of the percentiles behind the conditions (oriented, so "lte" conditions count inverted).
   const ranks=checks.map((x,i)=>x.percentile===null?null:stack.conditions[i].op==='lte'&&stack.conditions[i].by==='percentile'?100-x.percentile:x.percentile).filter(x=>x!==null);
   members.push({symbol:c.symbol,isin:c.isin,industry:industry.get(c.symbol)??null,rank:ranks.length?ranks.reduce((a,b)=>a+b,0)/ranks.length:valueOf(c,stack.conditions[0].metric),why:checks.map(x=>x.why)});
  }
  members.sort((a,b)=>(b.rank??-1)-(a.rank??-1)||a.symbol.localeCompare(b.symbol));
  const qualifying=members.length;
  return {id:stack.id,title:stack.title,thesis:stack.thesis,rule:ruleText(stack),priceSelected:!!stack.priceSelected,
   status:qualifying>=MIN_MEMBERS?'LISTED':'TOO_FEW_MEMBERS',qualifying,members:members.slice(0,MAX_MEMBERS)};
 });
 return {version:STACKS_VERSION,computedAt:scorecards?.computedAt??null,peerGroups:scorecards?.peerGroups??[],companies:companies.length,stacks,
  note:'Rules are our own, applied to NIFTY 50 scorecards (peer percentiles from NSE filings and daily prices). A stack is a list to research, not a recommendation.'};
}
