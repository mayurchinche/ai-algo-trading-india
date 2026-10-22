// Shared technical indicators for the live scanner, backtester, research replay and strategy specs.
// Every function takes complete input series and returns series of the same length.
// Bars without enough history are NaN: callers choose their own warm-up behaviour.
// Variants that differ between textbook and existing app behaviour are explicit options, never silent defaults.

function fail(message){ throw new TypeError(message); }
function period(value,name='period'){ if(!Number.isInteger(value)||value<1) fail(`${name} must be a positive integer`); return value; }
function finiteSeries(values,name='values'){
 if(!Array.isArray(values)) fail(`${name} must be an array`);
 for(let i=0;i<values.length;i++) if(typeof values[i]!=='number'||!Number.isFinite(values[i])) fail(`${name}[${i}] must be a finite number`);
 return values;
}
// Derived series (for example MACD lines) may carry a NaN warm-up prefix, but no gaps afterwards.
function prefixedSeries(values,name='values'){
 if(!Array.isArray(values)) fail(`${name} must be an array`);
 let start=0; while(start<values.length&&Number.isNaN(values[start])) start++;
 for(let i=start;i<values.length;i++) if(typeof values[i]!=='number'||!Number.isFinite(values[i])) fail(`${name}[${i}] must be finite after its warm-up prefix`);
 return start;
}
function sameLength(...series){ const n=series[0].length; if(series.some(s=>s.length!==n)) fail('input series must have equal length'); return n; }
const empty=n=>new Array(n).fill(NaN);

export function sma(values,length){
 finiteSeries(values); period(length,'length');
 const out=empty(values.length);
 for(let i=length-1;i<values.length;i++){ let sum=0; for(let j=i-length+1;j<=i;j++) sum+=values[j]; out[i]=sum/length; }
 return out;
}

// Population standard deviation over a rolling window (Bollinger convention).
export function stdev(values,length){
 finiteSeries(values); period(length,'length');
 const mean=sma(values,length), out=empty(values.length);
 for(let i=length-1;i<values.length;i++){ let sumSq=0; for(let j=i-length+1;j<=i;j++) sumSq+=(values[j]-mean[i])**2; out[i]=Math.sqrt(sumSq/length); }
 return out;
}

// seed 'sma': standard EMA, first value is the SMA of the first `length` inputs (TradingView ta.ema).
// seed 'first': legacy app EMA, starts at the first input and is defined from index 0.
export function ema(values,length,{seed='sma'}={}){
 period(length,'length');
 if(seed!=='sma'&&seed!=='first') fail("seed must be 'sma' or 'first'");
 const start=prefixedSeries(values), out=empty(values.length), k=2/(length+1);
 if(seed==='first'){
  if(start>=values.length) return out;
  out[start]=values[start];
  for(let i=start+1;i<values.length;i++) out[i]=values[i]*k+out[i-1]*(1-k);
  return out;
 }
 const first=start+length-1;
 if(first>=values.length) return out;
 let sum=0; for(let j=start;j<=first;j++) sum+=values[j];
 out[first]=sum/length;
 for(let i=first+1;i<values.length;i++) out[i]=values[i]*k+out[i-1]*(1-k);
 return out;
}

// Wilder's running moving average (TradingView ta.rma), seeded with the SMA of the first `length` inputs.
export function rma(values,length){
 period(length,'length');
 const start=prefixedSeries(values), out=empty(values.length), first=start+length-1;
 if(first>=values.length) return out;
 let sum=0; for(let j=start;j<=first;j++) sum+=values[j];
 out[first]=sum/length;
 for(let i=first+1;i<values.length;i++) out[i]=(out[i-1]*(length-1)+values[i])/length;
 return out;
}

// method 'wilder': standard RSI. method 'simple': Cutler RSI, plain averages of the last `length` changes (legacy app RSI).
export function rsi(values,length=14,{method='wilder'}={}){
 finiteSeries(values); period(length,'length');
 if(method!=='wilder'&&method!=='simple') fail("method must be 'wilder' or 'simple'");
 const out=empty(values.length);
 const fromAverages=(gain,loss)=>loss===0?100:100-(100/(1+gain/loss));
 if(method==='simple'){
  for(let i=length;i<values.length;i++){
   let gains=0,losses=0;
   for(let j=i-length+1;j<=i;j++){ const diff=values[j]-values[j-1]; if(diff>0) gains+=diff; else losses-=diff; }
   out[i]=losses===0?100:100-(100/(1+(gains/length)/(losses/length)));
  }
  return out;
 }
 if(values.length<=length) return out;
 let gain=0,loss=0;
 for(let j=1;j<=length;j++){ const diff=values[j]-values[j-1]; if(diff>0) gain+=diff; else loss-=diff; }
 gain/=length; loss/=length; out[length]=fromAverages(gain,loss);
 for(let i=length+1;i<values.length;i++){
  const diff=values[i]-values[i-1];
  gain=(gain*(length-1)+Math.max(diff,0))/length; loss=(loss*(length-1)+Math.max(-diff,0))/length;
  out[i]=fromAverages(gain,loss);
 }
 return out;
}

export function macd(values,{fast=12,slow=26,signal=9,seed='sma'}={}){
 finiteSeries(values); period(fast,'fast'); period(slow,'slow'); period(signal,'signal');
 if(fast>=slow) fail('fast must be shorter than slow');
 const fastLine=ema(values,fast,{seed}), slowLine=ema(values,slow,{seed});
 const line=values.map((_,i)=>fastLine[i]-slowLine[i]);
 const signalLine=ema(line,signal,{seed});
 return {macd:line,signal:signalLine,histogram:line.map((v,i)=>v-signalLine[i])};
}

// The first bar has no previous close, so its true range is its own high-low range.
export function trueRange(high,low,close){
 finiteSeries(high,'high'); finiteSeries(low,'low'); finiteSeries(close,'close');
 const n=sameLength(high,low,close), out=new Array(n);
 for(let i=0;i<n;i++) out[i]=i===0?high[i]-low[i]:Math.max(high[i]-low[i],Math.abs(high[i]-close[i-1]),Math.abs(low[i]-close[i-1]));
 return out;
}

// method 'wilder': standard ATR (TradingView ta.atr). method 'simple': mean of the last `length` true ranges,
// each with a previous close, so it starts at index `length` (legacy app ATR).
export function atr(high,low,close,length=14,{method='wilder'}={}){
 period(length,'length');
 if(method!=='wilder'&&method!=='simple') fail("method must be 'wilder' or 'simple'");
 const tr=trueRange(high,low,close);
 if(method==='wilder') return rma(tr,length);
 const out=empty(tr.length);
 for(let i=length;i<tr.length;i++){ let sum=0; for(let j=i-length+1;j<=i;j++) sum+=tr[j]; out[i]=sum/length; }
 return out;
}

// percentB is 0 at the lower band and 1 at the upper band; NaN when the bands collapse.
export function bollinger(values,length=20,multiplier=2){
 finiteSeries(values); period(length,'length');
 if(!(Number.isFinite(multiplier)&&multiplier>0)) fail('multiplier must be a positive number');
 const middle=sma(values,length), deviation=stdev(values,length);
 const upper=middle.map((m,i)=>m+multiplier*deviation[i]), lower=middle.map((m,i)=>m-multiplier*deviation[i]);
 const percentB=values.map((v,i)=>upper[i]===lower[i]?NaN:(v-lower[i])/(upper[i]-lower[i]));
 return {middle,upper,lower,percentB};
}

export function highest(values,length){
 finiteSeries(values); period(length,'length');
 const out=empty(values.length);
 for(let i=length-1;i<values.length;i++){ let max=-Infinity; for(let j=i-length+1;j<=i;j++) max=Math.max(max,values[j]); out[i]=max; }
 return out;
}
export function lowest(values,length){
 finiteSeries(values); period(length,'length');
 const out=empty(values.length);
 for(let i=length-1;i<values.length;i++){ let min=Infinity; for(let j=i-length+1;j<=i;j++) min=Math.min(min,values[j]); out[i]=min; }
 return out;
}
// Channel includes the current bar. Shift the result by one bar for "breaks the previous N-bar high" rules.
export function donchian(high,low,length=20){
 const upper=highest(high,length), lower=lowest(low,length);
 sameLength(high,low);
 return {upper,lower,middle:upper.map((u,i)=>(u+lower[i])/2)};
}

// Zero-lag EMA: EMA of 2*src - src[lag], lag = floor((length-1)/2).
export function zlema(values,length){
 finiteSeries(values); period(length,'length');
 const lag=Math.floor((length-1)/2);
 return ema(values.map((v,i)=>i<lag?NaN:2*v-values[i-lag]),length);
}

// TradingView ta.supertrend semantics on hl2 with Wilder ATR. direction is 1 (bullish, line below price)
// or -1 (bearish, line above price); NaN until ATR is available.
export function supertrend(high,low,close,length=10,multiplier=3){
 if(!(Number.isFinite(multiplier)&&multiplier>0)) fail('multiplier must be a positive number');
 const range=atr(high,low,close,length), n=range.length;
 const line=empty(n), direction=empty(n);
 let prevUpper=NaN,prevLower=NaN,prevLine=NaN;
 for(let i=0;i<n;i++){
  if(Number.isNaN(range[i])) continue;
  const mid=(high[i]+low[i])/2;
  let upper=mid+multiplier*range[i], lower=mid-multiplier*range[i];
  if(!Number.isNaN(prevLower)) lower=lower>prevLower||close[i-1]<prevLower?lower:prevLower;
  if(!Number.isNaN(prevUpper)) upper=upper<prevUpper||close[i-1]>prevUpper?upper:prevUpper;
  let dir;
  if(Number.isNaN(prevLine)) dir=-1;
  else if(prevLine===prevUpper) dir=close[i]>upper?1:-1;
  else dir=close[i]<lower?-1:1;
  line[i]=dir===1?lower:upper; direction[i]=dir;
  prevUpper=upper; prevLower=lower; prevLine=line[i];
 }
 return {line,direction};
}

// Volume-weighted average typical price. Pass `sessions` (one key per bar, e.g. the IST date) to reset each session.
export function vwap(high,low,close,volume,sessions){
 finiteSeries(high,'high'); finiteSeries(low,'low'); finiteSeries(close,'close'); finiteSeries(volume,'volume');
 const n=sameLength(high,low,close,volume);
 if(sessions!==undefined&&(!Array.isArray(sessions)||sessions.length!==n)) fail('sessions must be an array matching the bars');
 const out=empty(n); let priceVolume=0,totalVolume=0;
 for(let i=0;i<n;i++){
  if(sessions&&i>0&&sessions[i]!==sessions[i-1]){ priceVolume=0; totalVolume=0; }
  if(volume[i]<0) fail(`volume[${i}] must not be negative`);
  priceVolume+=(high[i]+low[i]+close[i])/3*volume[i]; totalVolume+=volume[i];
  out[i]=totalVolume>0?priceVolume/totalVolume:NaN;
 }
 return out;
}

// Opening range of each session: high, low and close over its first `bars` bars, the session open and the
// previous session's last close. Values exist only from the bar that completes the range onward, so a
// condition can never see the range before it has finished forming.
export function openingRange(open,high,low,close,sessions,bars){
 finiteSeries(open,'open'); finiteSeries(high,'high'); finiteSeries(low,'low'); finiteSeries(close,'close');
 const n=sameLength(open,high,low,close);
 if(!Array.isArray(sessions)||sessions.length!==n) fail('sessions must be an array matching the bars');
 if(!Number.isInteger(bars)||bars<1) fail('bars must be a positive integer');
 const out={high:empty(n),low:empty(n),open:empty(n),close:empty(n),prevClose:empty(n),gapPct:empty(n)};
 let start=0,hi=-Infinity,lo=Infinity,prev=NaN;
 for(let i=0;i<n;i++){
  if(i>0&&sessions[i]!==sessions[i-1]){prev=close[i-1];start=i;hi=-Infinity;lo=Infinity;}
  const k=i-start;
  if(k<bars){hi=Math.max(hi,high[i]);lo=Math.min(lo,low[i]);}
  if(k>=bars-1){out.high[i]=hi;out.low[i]=lo;out.open[i]=open[start];out.close[i]=close[start+bars-1];out.prevClose[i]=prev;out.gapPct[i]=prev>0?(open[start]/prev-1)*100:NaN;}
 }
 return out;
}
// Gap of each bar's open from the previous bar's close, in percent (daily bars: the overnight gap).
export function gapPercent(open,close){
 finiteSeries(open,'open'); finiteSeries(close,'close');
 const n=sameLength(open,close),out=empty(n);
 for(let i=1;i<n;i++)if(close[i-1]>0)out[i]=(open[i]/close[i-1]-1)*100;
 return out;
}
// Each bar's volume relative to the average volume of the `length` bars before it.
export function volumeRatio(volume,length){
 finiteSeries(volume,'volume');const n=volume.length,out=empty(n);let sum=0;
 for(let i=0;i<n;i++){if(i>=length&&sum>0)out[i]=volume[i]/(sum/length);sum+=volume[i];if(i>=length)sum-=volume[i-length];}
 return out;
}
// True on the bar where a moves from <= b to > b (crossover) or from >= b to < b (crossunder).
// `b` may be a series or a constant level. Bars with an undefined side are false.
function levels(a,b){
 if(!Array.isArray(a)) fail('a must be an array');
 if(typeof b==='number') return new Array(a.length).fill(b);
 if(!Array.isArray(b)||b.length!==a.length) fail('b must be a number or a series matching a');
 return b;
}
export function crossover(a,b){
 const other=levels(a,b);
 return a.map((v,i)=>i>0&&[v,other[i],a[i-1],other[i-1]].every(Number.isFinite)&&v>other[i]&&a[i-1]<=other[i-1]);
}
export function crossunder(a,b){
 const other=levels(a,b);
 return a.map((v,i)=>i>0&&[v,other[i],a[i-1],other[i-1]].every(Number.isFinite)&&v<other[i]&&a[i-1]>=other[i-1]);
}

// ---- Technical rating (after TradingView's published "Technical Ratings" method) -------------------------------
// Weighted MA: linear weights 1..length, newest heaviest.
function wma(values,length){
 const start=prefixedSeries(values),out=empty(values.length),den=length*(length+1)/2;
 for(let i=start+length-1;i<values.length;i++){let s=0;for(let j=0;j<length;j++)s+=values[i-j]*(length-j);out[i]=s/den;}
 return out;
}
const hullMa=(values,length)=>{const half=wma(values,Math.floor(length/2)),full=wma(values,length);return wma(half.map((h,i)=>Number.isNaN(h)||Number.isNaN(full[i])?NaN:2*h-full[i]),Math.round(Math.sqrt(length)));};
const vwma=(close,volume,length)=>{const pv=sma(close.map((c,i)=>c*volume[i]),length),v=sma(volume,length);return pv.map((x,i)=>v[i]>0?x/v[i]:NaN);};
// Raw stochastic %K of `src` against the high/low range of the last `length` bars.
function stoch(src,high,low,length){
 const out=empty(src.length);
 for(let i=0;i<src.length;i++){if(i<length-1)continue;let hi=-Infinity,lo=Infinity,ok=true;for(let j=i-length+1;j<=i;j++){if(Number.isNaN(high[j])||Number.isNaN(low[j])){ok=false;break;}hi=Math.max(hi,high[j]);lo=Math.min(lo,low[j]);}
  if(ok&&!Number.isNaN(src[i]))out[i]=hi===lo?NaN:(src[i]-lo)/(hi-lo)*100;}
 return out;
}
const smaGapped=(values,length)=>values.map((_,i)=>{if(i<length-1)return NaN;let s=0;for(let j=i-length+1;j<=i;j++){if(Number.isNaN(values[j]))return NaN;s+=values[j];}return s/length;});
function cci(high,low,close,length){
 const tp=close.map((c,i)=>(high[i]+low[i]+c)/3),m=sma(tp,length),out=empty(close.length);
 for(let i=length-1;i<close.length;i++){let d=0;for(let j=i-length+1;j<=i;j++)d+=Math.abs(tp[j]-m[i]);d/=length;out[i]=d>0?(tp[i]-m[i])/(0.015*d):NaN;}
 return out;
}
// Wilder's directional movement: +DI, -DI and ADX (TradingView ta.dmi).
function dmi(high,low,close,length,smoothing){
 const n=close.length,up=empty(n),down=empty(n);
 for(let i=1;i<n;i++){const u=high[i]-high[i-1],d=low[i-1]-low[i];up[i]=u>d&&u>0?u:0;down[i]=d>u&&d>0?d:0;}
 const tr=trueRange(high,low,close).map((v,i)=>i===0?NaN:v),atrS=rma(tr,length),pS=rma(up,length),mS=rma(down,length);
 const plus=pS.map((v,i)=>atrS[i]>0?100*v/atrS[i]:NaN),minus=mS.map((v,i)=>atrS[i]>0?100*v/atrS[i]:NaN);
 const dx=plus.map((p,i)=>Number.isNaN(p)||Number.isNaN(minus[i])?NaN:p+minus[i]>0?100*Math.abs(p-minus[i])/(p+minus[i]):0);
 return {plus,minus,adx:rma(dx,smoothing)};
}
function ultimate(high,low,close,f=7,m=14,s=28){
 const n=close.length,bp=empty(n),tr=empty(n);
 for(let i=1;i<n;i++){const lo=Math.min(low[i],close[i-1]),hi=Math.max(high[i],close[i-1]);bp[i]=close[i]-lo;tr[i]=hi-lo;}
 const avg=len=>{const b=smaGapped(bp,len),t=smaGapped(tr,len);return b.map((x,i)=>t[i]>0?x/t[i]:NaN);};
 const a=avg(f),b=avg(m),c=avg(s);return a.map((x,i)=>100*(4*x+2*b[i]+c[i])/7);
}
// Ratings: each component votes +1 (buy), -1 (sell) or 0; the moving-average and oscillator ratings are the means
// of their votes and the rating is the mean of the two, in [-1, 1]. TradingView's bands: above 0.5 strong buy,
// 0.1 to 0.5 buy, -0.1 to 0.1 neutral, below -0.5 strong sell. NaN until every component has its history
// (about 200 bars, the SMA 200). Differences from TradingView: the Ichimoku leading spans are not shifted forward,
// and the trend filter of Stoch RSI and Bull Bear Power is the close against its 50-bar SMA.
export function technicalRating(high,low,close,volume){
 finiteSeries(high,'high');finiteSeries(low,'low');finiteSeries(close,'close');finiteSeries(volume,'volume');
 const n=sameLength(high,low,close,volume),vote=(b,s)=>b?1:s?-1:0,maVote=(ma,i)=>ma[i]<close[i]?1:ma[i]>close[i]?-1:0;
 const mas=[10,20,30,50,100,200].flatMap(l=>[sma(close,l),ema(close,l)]);mas.push(vwma(close,volume,20),hullMa(close,9));
 const mid=len=>{const h=highest(high,len),l=lowest(low,len);return h.map((x,i)=>(x+l[i])/2);};
 const conv=mid(9),base=mid(26),lead2=mid(52),lead1=conv.map((c,i)=>(c+base[i])/2);
 const r=rsi(close,14),k=smaGapped(stoch(close,high,low,14),3),d=smaGapped(k,3),c=cci(high,low,close,20),dm=dmi(high,low,close,14,14);
 const hl2=high.map((h,i)=>(h+low[i])/2),ao=sma(hl2,5).map((x,i)=>x-sma(hl2,34)[i]);
 const mom=close.map((x,i)=>i>=10?x-close[i-10]:NaN),mc=macd(close,{fast:12,slow:26,signal:9}),trend=sma(close,50);
 const rk=smaGapped(stoch(r,r,r,14),3),rd=smaGapped(rk,3),wr=stoch(close,high,low,14).map(x=>x-100),e13=ema(close,13),bull=high.map((h,i)=>h-e13[i]),bear=low.map((l,i)=>l-e13[i]),uo=ultimate(high,low,close);
 const rating=empty(n),maRating=empty(n),oscRating=empty(n);
 for(let i=2;i<n;i++){
  const p=i-1,needed=[...mas.map(m=>m[i]),lead1[i],lead2[i],r[p],k[p],d[p],c[p],dm.adx[i],dm.plus[p],dm.minus[p],ao[i-2],mom[p],mc.signal[i],trend[i],rk[p],rd[p],wr[p],bull[p],bear[p],uo[i]];
  if(needed.some(Number.isNaN))continue;
  const ich=vote(lead1[i]>lead2[i]&&close[i]>lead1[i]&&close[i]<base[i]&&close[p]<conv[p]&&close[i]>conv[i],lead2[i]>lead1[i]&&close[i]<lead2[i]&&close[i]>base[i]&&close[p]>conv[p]&&close[i]<conv[i]);
  const maV=[...mas.map(m=>maVote(m,i)),ich],up=close[i]>trend[i],down=close[i]<trend[i];
  const oscV=[vote(r[i]<30&&r[i]>r[p],r[i]>70&&r[i]<r[p]),
   vote(k[i]<20&&d[i]<20&&k[i]>d[i]&&k[p]<d[p],k[i]>80&&d[i]>80&&k[i]<d[i]&&k[p]>d[p]),
   vote(c[i]<-100&&c[i]>c[p],c[i]>100&&c[i]<c[p]),
   vote(dm.adx[i]>20&&dm.plus[p]<dm.minus[p]&&dm.plus[i]>dm.minus[i],dm.adx[i]>20&&dm.plus[p]>dm.minus[p]&&dm.plus[i]<dm.minus[i]),
   vote(ao[i]>0&&ao[p]<0||ao[i]>0&&ao[p]>0&&ao[i]>ao[p]&&ao[i-2]>ao[p],ao[i]<0&&ao[p]>0||ao[i]<0&&ao[p]<0&&ao[i]<ao[p]&&ao[i-2]<ao[p]),
   vote(mom[i]>mom[p],mom[i]<mom[p]),
   vote(mc.macd[i]>mc.signal[i],mc.macd[i]<mc.signal[i]),
   vote(down&&rk[i]<20&&rd[i]<20&&rk[i]>rd[i]&&rk[p]<rd[p],up&&rk[i]>80&&rd[i]>80&&rk[i]<rd[i]&&rk[p]>rd[p]),
   vote(wr[i]<-80&&wr[i]>wr[p],wr[i]>-20&&wr[i]<wr[p]),
   vote(up&&bear[i]<0&&bear[i]>bear[p],down&&bull[i]>0&&bull[i]<bull[p]),
   vote(uo[i]>70,uo[i]<30)];
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  maRating[i]=mean(maV);oscRating[i]=mean(oscV);rating[i]=(maRating[i]+oscRating[i])/2;
 }
 return {rating,maRating,oscRating};
}
