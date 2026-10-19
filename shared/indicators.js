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
 const out={high:empty(n),low:empty(n),open:empty(n),close:empty(n),prevClose:empty(n)};
 let start=0,hi=-Infinity,lo=Infinity,prev=NaN;
 for(let i=0;i<n;i++){
  if(i>0&&sessions[i]!==sessions[i-1]){prev=close[i-1];start=i;hi=-Infinity;lo=Infinity;}
  const k=i-start;
  if(k<bars){hi=Math.max(hi,high[i]);lo=Math.min(lo,low[i]);}
  if(k>=bars-1){out.high[i]=hi;out.low[i]=lo;out.open[i]=open[start];out.close[i]=close[start+bars-1];out.prevClose[i]=prev;}
 }
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
