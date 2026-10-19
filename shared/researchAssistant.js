// Deterministic research assistant: turns a typed question into an explicit plan over this app's own data
// (scorecards, screener columns, signals, opening gaps, portfolio fit). No language model and no external
// service: phrases are matched by fixed rules, and the plan states what was understood and what was ignored,
// so an answer never rests on a guess. Wording and rules are our own.
export const ASSISTANT_VERSION='research-assistant-v1';
export const MAX_RESULTS=30,DEFAULT_RESULTS=10;

// Phrase → screener column id. Longer phrases are matched first so "profit 3y" wins over "profit".
const METRIC_ALIASES=[
 ['debt to equity','debtToEquity'],['debt/equity','debtToEquity'],['d/e','debtToEquity'],['debt','debtToEquity'],
 ['p/e','pe'],['pe ratio','pe'],['pe','pe'],['peg','peg'],['roce','roce'],['roe','roe'],
 ['sales 5y','revenueGrowth5y'],['sales 3y','revenueGrowth3y'],['sales 1y','revenueGrowth1y'],['sales growth','revenueGrowth1y'],
 ['revenue 5y','revenueGrowth5y'],['revenue 3y','revenueGrowth3y'],['revenue 1y','revenueGrowth1y'],['revenue growth','revenueGrowth1y'],
 ['profit 5y','profitGrowth5y'],['profit 3y','profitGrowth3y'],['profit 1y','profitGrowth1y'],['profit growth','profitGrowth1y'],
 ['12m return','return12m'],['returns','return12m'],['1y return','return12m'],['one year return','return12m'],['return','return12m'],
 ['below high','belowHigh'],['from high','belowHigh'],['market cap','marketCap'],
].sort((a,b)=>b[0].length-a[0].length);
const OPS=[['at least','gte'],['greater than','gte'],['more than','gte'],['above','gte'],['over','gte'],['>=','gte'],['>','gte'],
 ['at most','lte'],['less than','lte'],['below','lte'],['under','lte'],['<=','lte'],['<','lte']];
export const STYLE_WORDS=Object.freeze({value:'value',garp:'garp',growth:'growth',compounder:'compounder',compounders:'compounder',momentum:'momentum',quality:'value',overall:'composite',best:'composite'});
// Sector words → NIFTY 50 industry names as published by NSE.
const SECTOR_WORDS=[['banks','Financial Services'],['bank','Financial Services'],['financial','Financial Services'],['finance','Financial Services'],['nbfc','Financial Services'],
 ['it','Information Technology'],['tech','Information Technology'],['software','Information Technology'],['pharma','Healthcare'],['healthcare','Healthcare'],['hospital','Healthcare'],
 ['auto','Automobile and Auto Components'],['automobile','Automobile and Auto Components'],['fmcg','Fast Moving Consumer Goods'],['consumer goods','Fast Moving Consumer Goods'],
 ['metal','Metals & Mining'],['metals','Metals & Mining'],['mining','Metals & Mining'],['oil','Oil Gas & Consumable Fuels'],['gas','Oil Gas & Consumable Fuels'],['energy','Oil Gas & Consumable Fuels'],
 ['power','Power'],['telecom','Telecommunication'],['cement','Construction Materials'],['capital goods','Capital Goods'],['infra','Construction'],['construction','Construction'],
 ['consumer durables','Consumer Durables'],['retail','Consumer Services'],['services','Services']].sort((a,b)=>b[0].length-a[0].length);

const escape=s=>s.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&');
const phrase=p=>new RegExp(`(?<![a-z0-9])${escape(p)}(?![a-z0-9])`);

// universe: [{symbol, industry}] — symbols are matched exactly (case-insensitive) as whole tokens.
export function parseQuestion(text,{universe=[]}={}){
 const raw=typeof text==='string'?text.trim().slice(0,500):'';
 const understood=[],plan={version:ASSISTANT_VERSION,question:raw,intent:'UNKNOWN',symbols:[],screen:null,industry:null,understood,ignored:[]};
 if(!raw)return {...plan,intent:'EMPTY'};
 const known=new Map(universe.map(m=>[m.symbol.toUpperCase(),m]));
 const symbols=[...new Set((raw.match(/[A-Za-z0-9][A-Za-z0-9&-]*/g)||[]).map(t=>t.toUpperCase()).filter(t=>known.has(t)))];
 plan.symbols=symbols;if(symbols.length)understood.push(`Companies: ${symbols.join(', ')}`);
 let q=' '+raw.toLowerCase().replace(/\s+/g,' ')+' ';
 for(const s of symbols)q=q.replace(new RegExp(`(?<![a-z0-9&-])${escape(s.toLowerCase())}(?![a-z0-9&-])`,'g'),' ');
 const has=re=>re.test(q);
 if(has(/\b(portfolio|holdings?|my stocks)\b/)){understood.push('Check how your holdings fit each investing style');return {...plan,intent:'PORTFOLIO_FIT'};}
 if(has(/\bsignals?\b/)){understood.push('Signals from validated strategies');return {...plan,intent:'SIGNALS'};}
 if(has(/\b(gaps?|gap-?ups?|gap-?downs?|pre-?open)\b/)){understood.push('Opening gaps from the NSE pre-open session');return {...plan,intent:'GAPS'};}
 if(has(/\b(compare|comparison|versus|vs\.?)\b/)||has(/ or /)&&symbols.length>=2){
  if(symbols.length<2)return {...plan,intent:'NEEDS_INPUT',message:'Name at least two NIFTY 50 symbols to compare, e.g. "Compare TCS and INFY".'};
  understood.push('Side-by-side comparison with per-style plus and minus points');return {...plan,intent:'COMPARE'};
 }
 // Conditions: "<metric> <operator> <number>[%]". Matched text is removed so later rules do not reread it.
 const filters=[];
 for(;;){
  let hit=null;
  for(const [alias,column] of METRIC_ALIASES)for(const [word,op] of OPS){
   const m=new RegExp(`(?<![a-z0-9])${escape(alias)}(?:\\s+(?:is|of))?\\s*${escape(word)}\\s*(-?\\d+(?:\\.\\d+)?)\\s*(%|x|percent)?`).exec(q);
   if(m&&(!hit||m.index<hit.m.index))hit={m,alias,column,op};
  }
  if(!hit)break;
  const value=Number(hit.m[1]);filters.push({column:hit.column,op:hit.op,value});
  understood.push(`${hit.alias} ${hit.op==='gte'?'at least':'at most'} ${value}`);
  q=q.slice(0,hit.m.index)+' '+q.slice(hit.m.index+hit.m[0].length);
 }
 if(filters.length>8)return {...plan,intent:'NEEDS_INPUT',message:'Use at most 8 conditions in one question.'};
 const limitMatch=/\b(?:top|first|best)\s+(\d{1,3})\b/.exec(q),limit=Math.min(MAX_RESULTS,Math.max(1,limitMatch?Number(limitMatch[1]):DEFAULT_RESULTS));
 if(limitMatch)q=q.replace(limitMatch[0],' best ');
 // Numbers left over were not attached to a supported metric (e.g. "dividend yield above 2"); they are reported.
 for(const m of q.matchAll(/-?\d+(?:\.\d+)?\s*%?/g)){const words=q.slice(0,m.index).trim().split(' ').filter(Boolean).slice(-3);while(words.length&&['with','and','where','having','stocks','companies'].includes(words[0]))words.shift();plan.ignored.push([...words,m[0].trim()].join(' '));}
 let industry=null;
 // "it" is a sector only when written as "IT"; otherwise it is the pronoun.
 for(const [word,name] of SECTOR_WORDS)if(phrase(word).test(q)&&(word!=='it'||/(?<![A-Za-z0-9])IT(?![A-Za-z0-9])/.test(raw))&&universe.some(m=>m.industry===name)){industry=name;q=q.replace(phrase(word),' ');break;}
 let styleId=null;
 for(const [word,id] of Object.entries(STYLE_WORDS))if(id!=='composite'&&phrase(word).test(q)){styleId=id;break;}
 if(!styleId&&/\b(best|top|strongest)\b/.test(q))styleId='composite';
 if(filters.length||industry||styleId){
  // Sort by the chosen style; with conditions only, by the first condition's column so nothing is
  // dropped for lacking a score.
  const sortBy=styleId?'score:'+styleId:filters.length?filters[0].column:'score:composite';
  // Lowest first when sorting by an "at most" condition (e.g. debt to equity below 0.5).
  const sortDirection=!styleId&&filters.length&&filters[0].op==='lte'?'asc':'desc';
  if(industry)understood.push(`Sector: ${industry}`);
  understood.push(`Sorted by ${sortBy.startsWith('score:')?sortBy.slice(6)+' score':sortBy} (${sortDirection==='asc'?'lowest':'highest'} first), up to ${limit} companies`);
  return {...plan,intent:'SCREEN',industry,screen:{filters,sortBy,sortDirection,limit}};
 }
 if(symbols.length===1){understood.push('Full stock analysis with per-style verdicts');return {...plan,intent:'ANALYSE'};}
 if(symbols.length>1){understood.push('Side-by-side comparison with per-style plus and minus points');return {...plan,intent:'COMPARE'};}
 return {...plan,intent:'UNKNOWN',message:'Not understood. Try one of the example questions; the assistant only answers from this app\'s data.'};
}

// Example questions, grouped. Our own wording; every one parses to a supported plan (tested).
export const PROMPT_LIBRARY=Object.freeze([
 {group:'Research a company',prompts:['Analyse RELIANCE','How does TCS fit each investing style?','Compare HDFCBANK and ICICIBANK','Compare TCS, INFY and HCLTECH']},
 {group:'Find ideas',prompts:['Top 10 value stocks','ROE above 20 and P/E below 30','Growth stocks with sales 3y above 12%','Best compounders in IT','Top 5 momentum stocks','Pharma stocks with debt to equity below 0.5']},
 {group:'Trading activity',prompts:['Any active signals today?','Show opening gaps']},
 {group:'Your portfolio',prompts:['Check my portfolio fit','How do my holdings score?']},
]);
