// 164 "predicted price" strategies named by the user (Megacellar browser list), re-implemented from their one-paragraph
// descriptions (data/descriptions.json). These are INTERPRETATIONS, not the original code. Each maps the last N bars to a
// predicted next price; the stock ranking score is predicted/close−1 (long only, >0). Parameters are fixed here, before any
// test. Cross-asset ones use an equal-weight NSE market proxy (setContext) instead of the original asset clusters/PCA.
const mean=a=>{let s=0;for(const x of a)s+=x;return s/a.length;};
const sd=a=>{const m=mean(a);let s=0;for(const x of a)s+=(x-m)**2;return Math.sqrt(s/Math.max(1,a.length-1));};
const sorted=a=>[...a].sort((x,y)=>x-y),qt=(a,p)=>{const s=sorted(a);return s[Math.min(s.length-1,Math.max(0,Math.round(p*(s.length-1))))];};
const med=a=>qt(a,.5),sg=x=>x>0?1:x<0?-1:0,clip=(x,a,b)=>Math.max(a,Math.min(b,x));
const diff=a=>a.slice(1).map((x,i)=>x-a[i]),rets=a=>a.slice(1).map((x,i)=>x/a[i]-1);
const lr=y=>{const n=y.length,mx=(n-1)/2,my=mean(y);let sxy=0,sxx=0;for(let i=0;i<n;i++){sxy+=(i-mx)*(y[i]-my);sxx+=(i-mx)**2;}const b=sxy/sxx,a=my-b*mx;let e=0;for(let i=0;i<n;i++)e+=(y[i]-a-b*i)**2;return {a,b,se:Math.sqrt(e/Math.max(1,n-2)/sxx),at:t=>a+b*t};};
const ema=(a,p,al=2/(p+1))=>{const o=[a[0]];for(let i=1;i<a.length;i++)o.push(al*a[i]+(1-al)*o[i-1]);return o;};
const sma=(a,p=a.length)=>mean(a.slice(-p)),atr=c=>mean(diff(c).map(Math.abs));
const zs=c=>{const s=sd(c);return s>0?(c.at(-1)-mean(c))/s:0;};
const corr=(a,b)=>{const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){n+=(a[i]-ma)*(b[i]-mb);da+=(a[i]-ma)**2;db+=(b[i]-mb)**2;}return da>0&&db>0?n/Math.sqrt(da*db):0;};
const acf=(y,k)=>{const m=mean(y);let n=0,d=0;for(let i=0;i<y.length;i++){d+=(y[i]-m)**2;if(i>=k)n+=(y[i]-m)*(y[i-k]-m);}return d>0?n/d:0;};
const beta=(r,rm)=>{const v=sd(rm)**2;return v>0?corr(r,rm)*sd(r)*sd(rm)/v:1;};
const rsi=(c,p=14)=>{let g=0,l=0;const d=diff(c).slice(-p);for(const x of d){if(x>0)g+=x;else l-=x;}return l===0?100:100-100/(1+g/l);};
const solve=(A,b)=>{const n=b.length,M=A.map((r,i)=>[...r,b[i]]);for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;[M[i],M[p]]=[M[p],M[i]];if(Math.abs(M[i][i])<1e-14)return null;for(let j=i+1;j<n;j++){const f=M[j][i]/M[i][i];for(let k=i;k<=n;k++)M[j][k]-=f*M[i][k];}}const x=Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=M[i][n];for(let j=i+1;j<n;j++)s-=M[i][j]*x[j];x[i]=s/M[i][i];}return x;};
const polyfit=(y,deg)=>{const n=y.length,X=y.map((_,i)=>-1+2*i/(n-1)),A=[],b=[];for(let r=0;r<=deg;r++){A.push([]);b.push(0);for(let c=0;c<=deg;c++)A[r].push(X.reduce((s,x)=>s+x**(r+c),0));for(let i=0;i<n;i++)b[r]+=y[i]*X[i]**r;}const co=solve(A,b);return co&&(t=>co.reduce((s,c,k)=>s+c*(-1+2*t/(n-1))**k,0));};
const yw=(y,p)=>{const m=mean(y),z=y.map(v=>v-m),g=Array.from({length:p+1},(_,k)=>{let s=0;for(let i=k;i<z.length;i++)s+=z[i]*z[i-k];return s/z.length;});const A=[];for(let i=0;i<p;i++){A.push([]);for(let j=0;j<p;j++)A[i].push(g[Math.abs(i-j)]);}const f=solve(A,g.slice(1,p+1));return f&&{m,f};};
const adx=(h,l,c,p=7)=>{let tr=0,pd=0,md=0;const dx=[];let pdi=0,mdi=0;for(let i=1;i<c.length;i++){const t=Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])),u=h[i]-h[i-1],d=l[i-1]-l[i],P=u>d&&u>0?u:0,M=d>u&&d>0?d:0;tr=tr-tr/p+t;pd=pd-pd/p+P;md=md-md/p+M;if(tr>0){pdi=100*pd/tr;mdi=100*md/tr;dx.push(pdi+mdi>0?100*Math.abs(pdi-mdi)/(pdi+mdi):0);}}const ad=[];dx.forEach((v,i)=>ad.push(i===0?v:(ad[i-1]*(p-1)+v)/p));return {adx:ad,pdi,mdi};};
const peaks=c=>{let p=0,t=0;for(let i=1;i<c.length-1;i++){if(c[i]>c[i-1]&&c[i]>c[i+1])p++;if(c[i]<c[i-1]&&c[i]<c[i+1])t++;}return {p,t};};
const dema=(c,p)=>{const e1=ema(c,p),e2=ema(e1,p);return 2*e1.at(-1)-e2.at(-1);},tema=(c,p)=>{const e1=ema(c,p),e2=ema(e1,p),e3=ema(e2,p);return 3*e1.at(-1)-3*e2.at(-1)+e3.at(-1);};
const pos=(c)=>{const hi=Math.max(...c),lo=Math.min(...c);return hi>lo?(c.at(-1)-lo)/(hi-lo):.5;};
const runs=r=>{const o=[];let k=0,s=0;for(const x of r){const g=sg(x);if(g===s&&g!==0)k++;else{if(k)o.push(k);k=1;s=g;}}if(k)o.push(k);return {all:o,cur:k};};
const kurt=r=>{const m=mean(r),s=sd(r);return s>0?mean(r.map(x=>((x-m)/s)**4)):3;};
const wmed=(v,w)=>{const o=v.map((x,i)=>[x,w[i]]).sort((a,b)=>a[0]-b[0]),t=w.reduce((a,b)=>a+b,0);let a=0;for(const [x,wi] of o){a+=wi;if(a>=t/2)return x;}return v.at(-1);};
// Market context: equal-weight index over liquid stocks + per-date sorted closes, built from the (possibly truncated) data.
export const CTX={mkt:new Map(),px:new Map(),up:new Map()};
export function setContext({meta,series}){
 const lvl=new Map(),sum=new Map(),cnt=new Map(),px=new Map();
 for(const s of series)for(let i=1;i<s.d.length;i++){if(!(s.val[i-1]>=5e7)||!(s.c[i-1]>=50)||s.brk[i])continue;const r=s.c[i]/s.c[i-1]-1;if(Math.abs(r)>.25)continue;const d=s.d[i];sum.set(d,(sum.get(d)||0)+r);cnt.set(d,(cnt.get(d)||0)+1);
  if(!px.has(d))px.set(d,[]);px.get(d).push(s.c[i]);}
 let L=100;for(const d of meta.days){if(cnt.get(d)>20)L*=1+sum.get(d)/cnt.get(d);lvl.set(d,L);}
 for(const a of px.values())a.sort((x,y)=>x-y);CTX.mkt=lvl;CTX.px=px;
 const up=new Map(),arr=meta.days.map(d=>lvl.get(d));meta.days.forEach((d,i)=>{if(i>=100)up.set(d,arr[i]>mean(arr.slice(i-99,i+1)));});CTX.up=up;
}
// Each entry: [window N, fn(x)→predicted price]. x={c,h,l,v,d,n,cur,r,m (market closes aligned),rm (market returns),b (beta),px (percentile of price in market)}
export const PRED={
 ADXRPersistence:[40,x=>{const a=adx(x.h,x.l,x.c,7),A=a.adx,n=A.length,ar=(A[n-1]+A[n-8])/2,ap=(A[n-2]+A[n-9])/2;return x.cur*(1+.1*(ar-ap)/100*sg(a.pdi-a.mdi));}],
 ADXThresholdTrend:[40,x=>{const a=adx(x.h,x.l,x.c,7);return a.adx.at(-1)>25?x.cur*(1+.02*sg(a.pdi-a.mdi)):x.cur;}],
 AR1Online:[20,x=>{const y=x.c.slice(1),z=x.c.slice(0,-1),mz=mean(z),my=mean(y);let n=0,d=0;for(let i=0;i<y.length;i++){n+=(z[i]-mz)*(y[i]-my);d+=(z[i]-mz)**2;}const f=d>0?n/d:1;return my-f*mz+f*x.cur;}],
 ATRApproxFromCloses:[20,x=>{const w=Math.min(1,atr(x.c)/x.cur*20);return x.cur+w*(mean(x.c)-x.cur);}],
 ATRFilteredBreakout:[20,x=>{const p=x.c.slice(0,-1),a=atr(x.c),hi=Math.max(...p),lo=Math.min(...p);return x.cur>hi+.5*a?x.cur*1.02:x.cur<lo-.5*a?x.cur*.98:x.cur;}],
 AdaptiveBandReversion:[20,x=>{const m=mean(x.c),s=sd(x.c),k=qt(x.c.map(v=>Math.abs(v-m)/s),.9);return Math.abs(x.cur-m)>k*s?m:x.cur;}],
 AdaptiveBounce:[20,x=>{const r1=x.r.at(-1),mx=Math.max(...x.r.map(Math.abs));return x.cur*(1-r1*Math.min(1,Math.abs(r1)/mx));}],
 AdaptiveChannelWidth:[20,x=>{const m=mean(x.c),s=sd(x.c);return zs(x.c)>0?m+2*s:m-2*s;}],
 AdaptiveEWMA:[20,x=>{let best=null;for(const al of[.05,.1,.2,.3,.5]){const e=ema(x.c,0,al);let er=0;for(let i=1;i<x.c.length;i++)er+=(x.c[i]-e[i-1])**2;if(!best||er<best.er)best={er,p:e.at(-1)};}return best.p;}],
 AdaptiveMidpoint:[20,x=>ema(x.h.map((v,i)=>(v+x.l[i])/2),0,.3).at(-1)],
 AdaptiveSlopeFilter:[20,x=>{const f=lr(x.c);return Math.abs(f.b)>2*f.se?f.at(x.n):x.cur;}],
 AdaptiveStdBand:[40,x=>{const w=clip(Math.round(.02/(sd(x.r)||1)),5,x.n),c=x.c.slice(-w);return x.cur-.5*(x.cur-mean(c));}],
 AdaptiveThreshold:[20,x=>{const k=clip(kurt(x.r)/3,1,3);return Math.abs(zs(x.c))>k?mean(x.c):x.cur;}],
 AdaptiveWindowSMA:[40,x=>sma(x.c,clip(Math.round((sd(x.r)||.01)*1000),2,x.n))],
 AverageRunLengthReversion:[20,x=>{const a=runs(x.r).all;return x.cur*(1-sg(x.r.at(-1))*.01/mean(a));}],
 BasketVolatilityReversion:[20,x=>sd(x.rm)>.012?mean(x.c):x.cur],
 BollingerBandBreakout:[20,x=>{const m=mean(x.c),s=sd(x.c),u=m+2*s,lo=m-2*s;return x.cur>u?x.cur+(x.cur-u):x.cur<lo?x.cur-(lo-x.cur):x.cur;}],
 BollingerBandwidth:[20,x=>x.cur*(1+4*sd(x.c)/mean(x.c))],
 BreadthThrustMagnitude:[20,x=>{const s=sma(x.c,10);return x.cur*(1+(x.c.filter(v=>v>s).length/x.n-.5)*.1);}],
 CenterOfGravityIndicator:[20,x=>{let a=0,b=0;x.c.forEach((v,i)=>{a+=i*v;b+=i;});return a/b;}],
 ChaikinMoneyFlowGradient:[30,x=>{const m=x.c.map((c,i)=>x.h[i]>x.l[i]?((c-x.l[i])-(x.h[i]-c))/(x.h[i]-x.l[i])*x.v[i]:0),o=[];for(let i=9;i<x.n;i++){const vs=x.v.slice(i-9,i+1).reduce((a,b)=>a+b,0);o.push(vs>0?m.slice(i-9,i+1).reduce((a,b)=>a+b,0)/vs:0);}return x.cur*(1+lr(o).b);}],
 ChaikinOscillatorSpread:[30,x=>{let a=0;const ad=x.c.map((c,i)=>(a+=x.h[i]>x.l[i]?((c-x.l[i])-(x.h[i]-c))/(x.h[i]-x.l[i])*x.v[i]:0));return x.cur*(1+(ema(ad,3).at(-1)-ema(ad,10).at(-1))/(mean(x.v)*10));}],
 ChebyshevPolynomialFit:[20,x=>{const f=polyfit(x.c,3);return f?f(x.n):x.cur;}],
 CointegrationPairForecast:[40,x=>{const a=x.c.map(Math.log),b=x.m.map(Math.log),f=lr(b),mb=mean(b),ma=mean(a);let n=0,d=0;for(let i=0;i<a.length;i++){n+=(b[i]-mb)*(a[i]-ma);d+=(b[i]-mb)**2;}const be=d>0?n/d:1,e=a.at(-1)-(ma+be*(b.at(-1)-mb));return f?x.cur*Math.exp(-.5*e):x.cur;}],
 CloseRangeOscillator:[20,x=>x.cur*(1-.01*zs(x.c))],
 CompositeATRBand:[20,x=>{const c=(ema(x.c,10).at(-1)+sma(x.c))/2,a=atr(x.c);return Math.abs(x.cur-c)>2*a?c:x.cur;}],
 CompositeCrossAssetClusterReversion:[20,x=>{const z=zs(x.m);return Math.abs(z)>1.5?x.cur*(1-.02*sg(z)*x.b):x.cur;}],
 CompositeCrossAssetClusterTrend:[20,x=>{const t=x.m.at(-1)/x.m[0]-1;return Math.abs(t)>.03?x.cur*(1+.01*sg(t)*x.b):x.cur;}],
 CompositeRangeMomentum:[20,x=>{const rg=k=>mean(x.h.slice(-k).map((v,i)=>v-x.l.slice(-k)[i]));return x.cur*(1+(rg(5)+rg(10)+rg(x.n))/3/x.cur);}],
 CopulaTailDependence:[40,x=>{const q=a=>qt(a,.1),qs=q(x.r),qm=q(x.rm);let b=0,t=0;x.rm.forEach((v,i)=>{if(v<=qm){b++;if(x.r[i]<=qs)t++;}});return b&&t/b>.5?x.cur*(1-.02*sg(x.m.at(-1)-x.m[0])):x.cur;}],
 CrossAssetBetaClusters:[20,x=>x.cur*(1+.5*(x.m.at(-1)/x.m[0]-1)*x.b)],
 CrossAssetCCI:[20,x=>{let a=0;const cum=x.r.map((v,i)=>(a+=v-x.rm[i])),m=mean(cum),md=mean(cum.map(v=>Math.abs(v-m)));return x.cur*(1-.0001*((cum.at(-1)-m)/(.015*(md||1))));}],
 CrossAssetDistanceToCentroid:[20,x=>{const d=Math.sqrt(x.r.reduce((s,v,i)=>s+(v-x.rm[i])**2,0));return d>1.5*Math.sqrt(x.r.length)*sd(x.rm)?x.cur*(1-.5*(x.r.at(-1)-x.rm.at(-1))):x.cur;}],
 CrossAssetMDAndRange:[20,x=>{const z=(x.r.at(-1)-mean(x.r))/(sd(x.r)||1);return Math.abs(z)>2?x.cur*(1-.5*x.r.at(-1)):x.cur;}],
 CrossAssetMomentumClusters:[20,x=>x.cur*(1+.5*((x.cur/x.c[0]-1)-(x.m.at(-1)/x.m[0]-1)))],
 CrossAssetPCAExplainedVarianceTrend:[40,x=>corr(x.r,x.rm)**2>.5?x.cur*(1+.5*(x.m.at(-1)/x.m[0]-1)*x.b):x.cur],
 CrossAssetPCAFirstComponent:[40,x=>{const mm=mean(x.m),mc=mean(x.c);let n=0,d=0;x.c.forEach((v,i)=>{n+=(x.m[i]-mm)*(v-mc);d+=(x.m[i]-mm)**2;});const b=d>0?n/d:0,e=mc+b*(x.m.at(-1)-mm);return x.cur+.5*(e-x.cur);}],
 CrossAssetPCAResidual:[40,x=>{const res=x.r.at(-1)-x.b*x.rm.at(-1);return x.cur*(1+x.b*mean(x.rm)-.3*res);}],
 CrossAssetRSI:[20,x=>{const f=x.r.filter((v,i)=>v>x.rm[i]).length/x.r.length;return x.cur*(1-.01*(f-.5)*2);}],
 CrossAssetRangeClusters:[20,x=>{const R=a=>(Math.max(...a)-Math.min(...a))/mean(a);return R(x.c)>1.5*R(x.m)?x.cur+.4*(mean(x.c)-x.cur):x.cur;}],
 CrossAssetReversionClusters:[20,x=>{const f=lr(x.c),e=x.cur-f.at(x.n-1);return Math.abs(e)>.5*sd(x.c)?x.cur-.5*e:x.cur;}],
 CrossAssetSpreadClusters:[40,x=>{const s=x.c.map((v,i)=>v/mean(x.c)-x.m[i]/mean(x.m)),z=(s.at(-1)-mean(s))/(sd(s)||1);return Math.abs(z)>1?x.cur*(1-.5*s.at(-1)):x.cur;}],
 CrossAssetStochastic:[14,x=>{const p=pos(x.c)*100;return p>80?x.cur*.98:p<20?x.cur*1.02:x.cur;}],
 CrossAssetVolatilityClusters:[20,x=>sd(x.r)>1.5*sd(x.rm)?x.cur+.3*(mean(x.c)-x.cur):x.cur],
 CrossAssetZScoreClusters:[20,x=>Math.abs(zs(x.c))>2?mean(x.c):x.cur+.2*(mean(x.c)-x.cur)],
 CrossSectionalInverseRank:[5,x=>x.cur*(1+(1-x.px)*.2)],
 CrossSigmaDivergence:[20,x=>{const q=sd(x.r)/(sd(x.rm)||1);return q>1.5?x.cur*(1-.5*x.r.at(-1)):q<.67?x.cur*(1+.5*x.r.at(-1)):x.cur;}],
 CumulativeDiffReversion:[20,x=>x.cur-lr(x.c.map(v=>v-x.c[0])).b],
 CumulativeSumReversion:[20,x=>{const m=mean(x.c);let s=0;for(const v of x.c)s+=v-m;return x.cur-s/x.n;}],
 CurrentRunReversion:[20,x=>{let k=0;for(let i=x.r.length-1;i>=0&&x.r[i]>0;i--)k++;return x.cur*(1-k/x.n);}],
 CycleAdjustedTrend:[20,x=>{const f=lr(x.c),res=x.c.map((v,i)=>v-f.at(i)),e=res.at(-1);return Math.abs(e)>1.5*mean(res.map(Math.abs))?x.cur-.5*e:f.at(x.n);}],
 DEMAProjection:[20,x=>dema(x.c,10)],
 DirectionalChangeRate:[20,x=>{let f=0;for(let i=1;i<x.r.length;i++)if(sg(x.r[i])!==sg(x.r[i-1]))f++;return x.cur*(1+(1-f/(x.r.length-1))/x.n);}],
 DistanceToMinMax:[20,x=>{const hi=Math.max(...x.c),lo=Math.min(...x.c);return x.cur*(1+.05*((hi-x.cur)-(x.cur-lo))/((hi-lo)||1));}],
 DonchianTrendReversion:[20,x=>{const hi=Math.max(...x.h),lo=Math.min(...x.l),p=(x.cur-lo)/((hi-lo)||1);return p>.9||p<.1?x.cur+.3*((hi+lo)/2-x.cur):x.cur+(x.cur-x.c[0])/x.n;}],
 DoubleLogFit:[20,x=>{const f=lr(x.c.map(v=>Math.log(Math.log(v))));return Math.exp(Math.exp(f.at(x.n)));}],
 DownDayReversion:[20,x=>x.cur*(1+x.r.filter(v=>v<0).length/x.n)],
 DrawdownBasedReentry:[20,x=>{const pk=Math.max(...x.c);return (pk-x.cur)/pk>.05?x.cur+.5*(pk-x.cur):x.cur;}],
 DynamicATRBand:[20,x=>{const m=mean(x.c),a=atr(x.c)||1e-9,k=qt(x.c.map(v=>Math.abs(v-m)/a),.8);return Math.abs(x.cur-m)>k*a?m:x.cur;}],
 EMAATRBand:[20,x=>{const e=ema(x.c,10).at(-1),a=atr(x.c);return Math.abs(x.cur-e)>2*a?e:x.cur+.5*(x.cur-e);}],
 EMAATRHybrid:[20,x=>{const e=ema(x.c,10).at(-1);return e+sg(x.cur-e)*atr(x.c);}],
 EhlersHomodyneFilter:[20,x=>{const a=2*Math.sin(Math.PI*.1);let y=x.c[0];for(const v of x.c)y=a*v+(1-a)*y;return y;}],
 EhlersSuperSmoother:[20,x=>{const a1=Math.exp(-1.414*Math.PI/10),b1=2*a1*Math.cos(1.414*Math.PI/10),c2=b1,c3=-a1*a1,c1=1-c2-c3;let y1=x.c[0],y2=x.c[0];for(let i=1;i<x.n;i++){const y=c1*(x.c[i]+x.c[i-1])/2+c2*y1+c3*y2;y2=y1;y1=y;}return y1;}],
 EntropyDivergence:[30,x=>{const lo=Math.min(...x.r),hi=Math.max(...x.r),bins=Array(5).fill(0);for(const v of x.r)bins[Math.min(4,Math.floor((v-lo)/((hi-lo)||1)*5))]++;const H=-bins.filter(b=>b).reduce((s,b)=>s+b/x.r.length*Math.log(b/x.r.length),0)/Math.log(5);return H<.6?x.cur*(1+.3*(x.cur/x.c[0]-1)):x.cur*(1-.5*x.r.at(-1));}],
 ExponentialReturnWeightedMA:[20,x=>{let a=0,b=0;for(let i=1;i<x.n;i++){const w=Math.abs(x.r[i-1])*Math.exp(.1*i);a+=w*x.c[i];b+=w;}return b>0?a/b:x.cur;}],
 ExtremeReturnBounce:[40,x=>Math.abs(x.r.at(-1)-mean(x.r))>2*sd(x.r)?x.cur*(1-.5*x.r.at(-1)):x.cur],
 FastSlowMomentumSpread:[20,x=>{const f=x.cur/x.c[x.n-6]-1,s=x.cur/x.c[0]-1;return x.cur*(1+.01*(f-s)/(sd(x.r)||1));}],
 FourierTrendProjection:[40,x=>{const f=lr(x.c),res=x.c.map((v,i)=>v-f.at(i)),n=x.n;let best=null;for(let k=1;k<=n/2;k++){let re=0,im=0;res.forEach((v,i)=>{re+=v*Math.cos(2*Math.PI*k*i/n);im-=v*Math.sin(2*Math.PI*k*i/n);});const m=Math.hypot(re,im);if(!best||m>best.m)best={m,re,im,k};}return f.at(n)+2/n*(best.re*Math.cos(2*Math.PI*best.k*n/n)-best.im*Math.sin(2*Math.PI*best.k*n/n));}],
 FractalAdaptiveMA:[16,x=>{const h=8,rg=(a)=>Math.max(...a)-Math.min(...a),n1=rg(x.h.slice(0,h))/h,n2=rg(x.h.slice(h))/h,n3=rg(x.h)/x.n,D=n1>0&&n2>0&&n3>0?(Math.log(n1+n2)-Math.log(n3))/Math.log(2):1,al=clip(Math.exp(-4.6*(D-1)),.01,1);let y=x.c[0];for(const v of x.c)y=al*v+(1-al)*y;return y;}],
 HalfLifeMeanReversion:[40,x=>{const y=x.c.map(Math.log),z=y.slice(0,-1),w=y.slice(1),mz=mean(z),mw=mean(w);let n=0,d=0;for(let i=0;i<z.length;i++){n+=(z[i]-mz)*(w[i]-mw);d+=(z[i]-mz)**2;}const b=d>0?n/d:1;if(!(b>0&&b<1))return x.cur;const hl=-Math.log(2)/Math.log(b);return x.cur*Math.exp((1-Math.exp(-Math.log(2)/hl))*(mean(y)-y.at(-1)));}],
 HighLowRangeBreak:[11,x=>{const p=x.c.slice(0,-1),hi=Math.max(...p),lo=Math.min(...p);return x.cur>hi?x.cur*(1+(x.cur-hi)/hi):x.cur<lo?x.cur*(1-(lo-x.cur)/lo):x.cur;}],
 HoltWintersSeasonal:[40,x=>{const m=5,al=.3,be=.1,ga=.1;let L=mean(x.c.slice(0,m)),B=0;const S=Array(m).fill(1);for(let i=m;i<x.n;i++){const s=S[i%m],Lp=L;L=al*(x.c[i]/s)+(1-al)*(L+B);B=be*(L-Lp)+(1-be)*B;S[i%m]=ga*(x.c[i]/L)+(1-ga)*s;}return (L+B)*S[x.n%m];}],
 IndividualVsBasketEnvelope:[20,x=>{const f=a=>(a.at(-1)-sma(a))/(.05*sma(a)),d=f(x.c)-f(x.m);return d>1?x.cur*.98:d<-1?x.cur*1.02:x.cur;}],
 IndividualVsBasketRSI:[20,x=>{const d=rsi(x.c)-rsi(x.m);return d>20?x.cur*.99:d<-20?x.cur*1.01:x.cur;}],
 IndividualVsBasketRange:[20,x=>{const R=a=>(Math.max(...a)-Math.min(...a))/mean(a);return R(x.c)>1.5*R(x.m)?x.cur+.3*(mean(x.c)-x.cur):x.cur;}],
 IndividualVsBasketVolatility:[20,x=>sd(x.r)<.8*sd(x.rm)?x.cur*(1+.3*(x.cur/x.c[0]-1)):x.cur],
 InterceptOnlyTrend:[20,x=>Math.max(.01,lr(x.c).a)],
 InterquartileRangeReversion:[20,x=>{const q1=qt(x.c,.25),q3=qt(x.c,.75);return med(x.c)*(1+.1*(.5-(x.cur-q1)/((q3-q1)||1)));}],
 KalmanFilterPrice:[20,x=>{const z=x.c.map(v=>v/x.c[0]);let p=z[0],v=0,P=[[1,0],[0,1]];const Q=1e-5,R=1e-4;for(let i=1;i<z.length;i++){const pp=p+v,P00=P[0][0]+P[0][1]+P[1][0]+P[1][1]+Q,P01=P[0][1]+P[1][1],P10=P[1][0]+P[1][1],P11=P[1][1]+Q,K0=P00/(P00+R),K1=P10/(P00+R),y=z[i]-pp;p=pp+K0*y;v=v+K1*y;P=[[(1-K0)*P00,(1-K0)*P01],[P10-K1*P00,P11-K1*P01]];}return (p+v)*x.c[0];}],
 KthOrderMoment:[20,x=>{const m=mean(x.r),s=sd(x.r)||1;return x.cur*(1-.01*mean(x.r.map(v=>((v-m)/s)**3)));}],
 Lag2Autocorr:[20,x=>{const r=acf(x.c,2);return x.c[x.n-3]*r+x.cur*(1-Math.abs(r));}],
 LinearDecayEnvelope:[20,x=>{const m=sma(x.c),d=.05*(x.n-1)/x.n;return Math.abs(x.cur/m-1)>d?m:x.cur;}],
 LinearTrendExtrapolation:[20,x=>lr(x.c).at(x.n)],
 LiquidityWeightedPrice:[20,x=>{let a=0,b=0;x.c.forEach((v,i)=>{const w=.9**(x.n-1-i);a+=w*v;b+=w;});return a/b;}],
 LocalConvexityReversion:[20,x=>{const c=x.c.slice(-5),d2=diff(diff(c));return x.cur+mean(d2.slice(-3));}],
 LocalLinearRegression:[20,x=>{const c=x.c.slice(-5);return lr(c).at(5);}],
 LogLinearFit:[20,x=>Math.exp(lr(x.c.map(Math.log)).at(x.n))],
 LogPriceTrendReversion:[20,x=>x.cur*Math.exp(-lr(x.c.map(Math.log)).b)],
 MaxPainPivot:[20,x=>{let a=0,b=0;x.c.forEach((v,i)=>{const w=.9**(x.n-1-i);a+=w*v;b+=w;});return x.cur+.3*(a/b-x.cur);}],
 MeanAbsDeviationScore:[20,x=>{const m=mean(x.c),mad=mean(x.c.map(v=>Math.abs(v-m)))||1e-9;return Math.abs(x.cur-m)/mad>1?x.cur-.3*(x.cur-m):x.cur;}],
 MeanOfTopKReturns:[20,x=>{const p=x.r.filter(v=>v>0).sort((a,b)=>b-a),k=Math.max(1,Math.ceil(p.length*.25));return p.length?x.cur*(1+mean(p.slice(0,k))):x.cur;}],
 MedianReversion:[20,x=>med(x.c)],
 MidPercentileCrossover:[20,x=>{const a=qt(x.c,.75),b=qt(x.c,.25);return x.cur>a?x.cur+(x.cur-a):x.cur<b?x.cur-(b-x.cur):x.cur;}],
 MinMaxBlend:[20,x=>{const mx=[],mn=[];for(let i=4;i<x.n;i++){mx.push(Math.max(...x.c.slice(i-4,i+1)));mn.push(Math.min(...x.c.slice(i-4,i+1)));}return .5*sma(mx,3)+.5*sma(mn,3);}],
 MinMaxSignFilter:[20,x=>{const p=pos(x.c);return p<.1?x.cur*1.01:p>.9?x.cur*.99:x.cur;}],
 MinMaxSlope:[20,x=>x.cur+(Math.max(...x.c)-Math.min(...x.c))/x.n],
 MomentumWithinBands:[20,x=>x.cur*(1+.02*clip((x.cur-sma(x.c))/(.05*sma(x.c)),-1,1))],
 NormalizedBandDeviationReversion:[20,x=>x.cur-.5*(x.cur-mean(x.c))],
 NormalizedMidpointDeviation:[20,x=>x.cur-.5*(x.cur-(Math.max(...x.h)+Math.min(...x.l))/2)],
 NormalizedRangeMomentum:[20,x=>x.cur*(1+(pos(x.c)-.5)*.02)],
 PainIndexReversion:[20,x=>{let pk=0,s=0;for(const v of x.c){pk=Math.max(pk,v);s+=(pk-v)/pk;}return s/x.n>.1?mean(x.c):x.cur;}],
 PairwiseDispersion:[20,x=>{const d=mean(x.c.map((v,i)=>v/x.c[0]-x.m[i]/x.m[0]));return x.cur*(1-.5*d);}],
 PairwiseMeanReversion:[20,x=>{const q=(x.cur/x.c[0])/(x.m.at(-1)/x.m[0]);return Math.abs(q-1)>.05?x.cur*q**-.5:x.cur;}],
 PeakCountReversion:[20,x=>{const {p}=peaks(x.c);return p>=x.n/4?x.cur-(x.cur-x.c[x.n-2]):x.cur+(x.cur-x.c[x.n-2]);}],
 PeakToPeakForecast:[20,x=>peaks(x.c).p>=2?mean(x.c):x.cur],
 PeakTroughRatio:[20,x=>{const {p,t}=peaks(x.c),d=x.cur-x.c[x.n-2];return p>t?x.cur+d:x.cur-d;}],
 PeakTroughReversion:[20,x=>{let lp=-1,lt=-1;for(let i=1;i<x.n-1;i++){if(x.c[i]>x.c[i-1]&&x.c[i]>x.c[i+1])lp=i;if(x.c[i]<x.c[i-1]&&x.c[i]<x.c[i+1])lt=i;}if(lp<0||lt<0)return x.cur;return lp>lt?x.cur+.3*(x.c[lt]-x.cur):x.cur+.3*(x.c[lp]-x.cur);}],
 PivotPointTrend:[20,x=>{const i=x.n-2,P=(x.h[i]+x.l[i]+x.c[i])/3,R=2*P-x.l[i],S=2*P-x.h[i];return x.cur>R?x.cur*1.01:x.cur<S?x.cur*.99:x.cur;}],
 PricePercentileScore:[20,x=>{const p=x.c.filter(v=>v<=x.cur).length/x.n;return p>.8?x.cur*.98:p<.2?x.cur*1.02:x.cur;}],
 QuantileATRHybrid:[20,x=>qt(x.c,.6)+sg(x.cur-med(x.c))*atr(x.c)*.5],
 QuantileMomentum:[20,x=>x.cur>med(x.c)?qt(x.c,.75):qt(x.c,.25)],
 RangeBoundOscillator:[20,x=>{const p=pos(x.c);return p>.8?x.cur*.98:p<.2?x.cur*1.02:x.cur;}],
 RealizedVolatilityMomentum:[20,x=>{const h=x.r.length>>1,up=sd(x.r.slice(h))>sd(x.r.slice(0,h)),d=sg(x.cur-x.c[0]);return x.cur*(1+(up?.02:-.02)*d);}],
 RecursiveEnvelope:[20,x=>{let c=x.c[0],w=0;for(let i=1;i<x.n;i++){c=.1*x.c[i]+.9*c;w=.1*(Math.abs(x.r[i-1])+0)+.9*w;}return Math.abs(x.cur-c)/c>2*w?c:x.cur;}],
 RecursiveLeastSquares:[20,x=>{let th=[x.c[0],0],P=[[1e4,0],[0,1e4]];const lam=.98;for(let t=0;t<x.n;t++){const h=[1,t],Ph=[P[0][0]*h[0]+P[0][1]*h[1],P[1][0]*h[0]+P[1][1]*h[1]],den=lam+h[0]*Ph[0]+h[1]*Ph[1],K=[Ph[0]/den,Ph[1]/den],e=x.c[t]-(th[0]+th[1]*t);th=[th[0]+K[0]*e,th[1]+K[1]*e];const hP=[h[0]*P[0][0]+h[1]*P[1][0],h[0]*P[0][1]+h[1]*P[1][1]];P=[[(P[0][0]-K[0]*hP[0])/lam,(P[0][1]-K[0]*hP[1])/lam],[(P[1][0]-K[1]*hP[0])/lam,(P[1][1]-K[1]*hP[1])/lam]];}return th[0]+th[1]*x.n;}],
 RecursiveMidpoint:[20,x=>ema(x.h.map((v,i)=>(v+x.l[i])/2),0,.2).at(-1)],
 ResidualATRBlend:[20,x=>x.cur-.5*(x.cur-lr(x.c).at(x.n-1))],
 ReturnATRBlend:[20,x=>x.cur*(1-((x.cur/x.c[0]-1)/((atr(x.c)/x.cur)||1e-9))*.1)],
 RollingAR2:[40,x=>{const f=yw(x.c,2);return f?f.m+f.f[0]*(x.cur-f.m)+f.f[1]*(x.c[x.n-2]-f.m):x.cur;}],
 RollingAR3:[40,x=>{const f=yw(x.c,3);return f?f.m+f.f[0]*(x.cur-f.m)+f.f[1]*(x.c[x.n-2]-f.m)+f.f[2]*(x.c[x.n-3]-f.m):x.cur;}],
 RollingClusterEnvelope:[20,x=>{const m=mean(x.m),s=sd(x.m),z=(x.m.at(-1)-m)/(s||1);return Math.abs(z)>1?x.cur*(1-.01*sg(z)*x.b):x.cur;}],
 RollingClusterMACD:[40,x=>{const f=ema(x.m,12),s=ema(x.m,26),mc=f.map((v,i)=>v-s[i]),sig=ema(mc,9);return x.cur*(1+.01*sg(mc.at(-1)-sig.at(-1))*x.b);}],
 RollingCompositeResidual:[20,x=>{const res=x.r.map((v,i)=>v-x.b*x.rm[i]);return x.cur*(1-.5*res.slice(-5).reduce((a,b)=>a+b,0));}],
 RollingMPV:[20,x=>{const lo=Math.min(...x.c),hi=Math.max(...x.c),w=(hi-lo)/8||1,b=Array(8).fill(0);for(const v of x.c)b[Math.min(7,Math.floor((v-lo)/w))]++;return lo+w*(b.indexOf(Math.max(...b))+.5);}],
 RollingMaxDrawdownReversion:[20,x=>{let pk=0,dd=0;for(const v of x.c){pk=Math.max(pk,v);dd=Math.max(dd,pk-v);}return x.cur+.5*dd;}],
 RollingMinMaxWeighted:[20,x=>.6*Math.max(...x.c)+.4*Math.min(...x.c)],
 RollingOutlierClip:[20,x=>clip(x.cur,mean(x.c)-2*sd(x.c),mean(x.c)+2*sd(x.c))],
 RollingPairSpreadZScore:[40,x=>{const s=x.c.map((v,i)=>v/x.c[0]-x.m[i]/x.m[0]),z=(s.at(-1)-mean(s))/(sd(s)||1);return Math.abs(z)>2?x.cur*(1+.01*sg(z)):x.cur;}],
 RollingPartialAutocorr:[20,x=>{const p=acf(x.c,1);return p*x.cur+(1-p)*mean(x.c);}],
 RollingRangeRatio:[20,x=>{const p=pos(x.c);return p>.7?x.cur*.99:p<.3?x.cur*1.01:x.cur;}],
 RollingSignOfMidpoint:[20,x=>x.cur*(1-.01*sg(x.cur-(Math.max(...x.h)+Math.min(...x.l))/2))],
 RollingWindowComplexityIndex:[20,x=>{const d2=diff(diff(x.c));let f=0;for(let i=1;i<d2.length;i++)if(sg(d2[i])!==sg(d2[i-1]))f++;return f/d2.length<=.3?x.cur+.5*(x.cur-x.c[0])/x.n:x.cur;}],
 RollingWindowEMAofMidpoint:[20,x=>ema(x.h.map((v,i)=>(v+x.l[i])/2),0,.3).at(-1)],
 RollingWindowEnvelope:[20,x=>Math.abs(x.cur/sma(x.c)-1)>.05?sma(x.c):x.cur],
 RollingWindowIrregularityIndex:[20,x=>{const d2=diff(diff(x.c));return sd(d2)**2>(.01*x.cur)**2?sma(x.c):lr(x.c).at(x.n);}],
 RollingWindowL2Norm:[20,x=>Math.sqrt(x.c.reduce((s,v)=>s+v*v,0))],
 RollingWindowLInfinityNorm:[20,x=>Math.max(...x.c)],
 RollingWindowMeanStdBand:[20,x=>Math.abs(x.cur-mean(x.c))>2*sd(x.c)?mean(x.c):x.cur],
 RollingWindowMidStdBlend:[20,x=>mean(x.c)+.5*(x.cur-mean(x.c))],
 RollingWindowRepeatedPercentileSmoothing:[20,x=>{const p=qt(x.c,.9);return sma(x.c.map(v=>Math.min(v,p)),5);}],
 RollingWindowSeasonalityTest:[20,x=>acf(x.c,5)>.3?x.c[x.n-5]:x.cur],
 RollingWindowSignChangeReversion:[20,x=>{const d=diff(x.c);let f=0;for(let i=1;i<d.length;i++)if(sg(d[i])!==sg(d[i-1]))f++;return f>d.length/2?mean(x.c):x.cur+(x.cur-x.c[x.n-2]);}],
 RollingWindowSmoothedMax:[20,x=>{const m=[];for(let i=4;i<x.n;i++)m.push(Math.max(...x.c.slice(i-4,i+1)));return sma(m,5);}],
 RollingWindowUpperEnvelopeForecast:[20,x=>x.cur>x.c[x.n-11]?sma(x.c)*1.05:sma(x.c)*.95],
 RollingWindowWeightedLpNorm:[20,x=>{let a=0,b=0;x.c.forEach((v,i)=>{const w=.9**(x.n-1-i);a+=w*Math.abs(v)**3;b+=w;});return (a/b)**(1/3);}],
 RollingWindowWeightedMidpoints:[20,x=>{let a=0,b=0;for(const k of[5,10,20]){const h=Math.max(...x.h.slice(-k)),l=Math.min(...x.l.slice(-k));a+=(h+l)/2*(h-l);b+=h-l;}return b>0?a/b:x.cur;}],
 RollingWindowZScoreMean:[20,x=>x.cur*(1-.02*zs(x.c))],
 RollingWindowZScoreReversion:[20,x=>{const m=mean(x.c),s=sd(x.c)||1,z=x.c.map(v=>(v-m)/s);return x.cur*(1-.02*lr(z).b*x.n/10);}],
 RollingWindowZeroCrossReversion:[20,x=>{const d=diff(x.c);let a=0;const cs=d.map(v=>(a+=v)),m=mean(cs);let f=0;for(let i=1;i<cs.length;i++)if(sg(cs[i]-m)!==sg(cs[i-1]-m))f++;return f>3?mean(x.c):x.cur;}],
 RoundNumberMagnet:[5,x=>{const st=x.cur<100?10:x.cur<500?50:100,rn=Math.round(x.cur/st)*st,d=Math.abs(rn-x.cur)/x.cur;return x.cur+(rn-x.cur)*.2/(1+d*100);}],
 RunLengthReversion:[20,x=>{const {cur:k}=runs(x.r);return x.cur*(1-x.r.at(-1)/k);}],
 SMAATRHybrid:[20,x=>{const s=sma(x.c);return s+sg(x.cur-s)*atr(x.c);}],
 SMAEMADifference:[20,x=>x.cur+sma(x.c)-ema(x.c,20).at(-1)],
 SimpleChannelReversion:[20,x=>{const lo=mean(x.c)-2*sd(x.c);return x.cur<lo?lo:x.cur;}],
 SincFilterProjection:[20,x=>{const M=11,c=x.c.slice(-M),w=c.map((_,i)=>{const t=i-(M-1)/2,s=t===0?.2:Math.sin(2*Math.PI*.1*t)/(Math.PI*t);return s*(.54-.46*Math.cos(2*Math.PI*i/(M-1)));}),sw=w.reduce((a,b)=>a+b,0);return c.reduce((s,v,i)=>s+v*w[i],0)/sw;}],
 SymmetricMAFilter:[20,x=>mean(x.c.slice(x.n-7))],
 TEMAProjection:[20,x=>tema(x.c,10)],
 TroughCountReversion:[20,x=>{const {t}=peaks(x.c);return t>=x.n/4?x.cur-(x.cur-x.c[x.n-2]):x.cur+(x.cur-x.c[x.n-2]);}],
 TukeyLambdaReversion:[20,x=>{const a=qt(x.c,.25),b=qt(x.c,.5),c=qt(x.c,.75),sk=(a+c-2*b)/((c-a)||1);return Math.abs(sk)<.1?b:x.cur*(1-.02*sk);}],
 UlcerIndexReversion:[20,x=>{let pk=0,s=0;for(const v of x.c){pk=Math.max(pk,v);s+=((pk-v)/pk*100)**2;}return x.cur+Math.min(1,Math.sqrt(s/x.n)/10)*(mean(x.c)-x.cur);}],
 WaveHeightMomentum:[20,x=>x.cur*(1+.1*(Math.max(...x.c)-Math.min(...x.c))/mean(x.c))],
 WeightedEMAByReturn:[20,x=>{let a=0,b=0;for(let i=1;i<x.n;i++){const w=Math.abs(x.r[i-1]);a+=w*x.c[i];b+=w;}return b>0?a/b:x.cur;}],
 WeightedMedianScore:[20,x=>wmed(x.c,x.c.map((_,i)=>i+1))],
 WilliamsRReactive:[14,x=>{const hi=Math.max(...x.h),lo=Math.min(...x.l),R=hi>lo?-100*(hi-x.cur)/(hi-lo):-50;return x.cur*(1-R/100);}],
};
const DOW=new Map();const dow=d=>{let v=DOW.get(d);if(v===undefined){v=new Date(d+'T00:00:00Z').getUTCDay();DOW.set(d,v);}return v;};
export const NAMES=Object.keys(PRED);
const retFor=(name,s,k)=>{
 const [N,fn]=PRED[name],a=k-N+1,x={c:s.c.slice(a,k+1),h:s.h.slice(a,k+1),l:s.l.slice(a,k+1),v:s.v.slice(a,k+1),d:s.d.slice(a,k+1),n:N,cur:s.c[k]};
 x.r=rets(x.c);x.m=x.d.map(d=>CTX.mkt.get(d));if(x.m.some(v=>!(v>0)))return null;x.rm=rets(x.m);x.b=beta(x.r,x.rm);
 const pxs=CTX.px.get(s.d[k]);{let lo=0,hi=pxs?pxs.length:0;while(lo<hi){const m=(lo+hi)>>1;if(pxs[m]<=x.cur)lo=m+1;else hi=m;}x.px=pxs?lo/pxs.length:.5;}
 const ret=fn(x)/x.cur-1;return Number.isFinite(ret)?ret:null;};
const sma200=(s,k)=>{let t=0;for(let i=k-199;i<=k;i++)t+=s.c[i];return t/200;};
export const FILTERS={none:null,mktUp:(s,k)=>CTX.up.get(s.d[k])===true,above200:(s,k)=>s.c[k]>sma200(s,k),both:(s,k)=>CTX.up.get(s.d[k])===true&&s.c[k]>sma200(s,k)};
// Friday-close decision → Monday open entry; fixed stop%/max hold bars set by the caller beforehand.
export function makeStrategy(name,{stopPct=6,maxDays=5,filter=null,id=name}={}){
 return {id,product:'equity-delivery',warmup:210,prepare:()=>null,
  signal(s,_x,k){
   if(dow(s.d[k])!==5||!(s.val[k]>=5e7)||(filter&&!filter(s,k)))return null;
   const ret=retFor(name,s,k);if(!(ret>0))return null;
   return {score:ret,stop:s.c[k]*(1-stopPct/100),maxDays};}};
}
// Consensus of several predictors: ≥minVotes of them predict a rise; rank by votes, ties by mean predicted return.
export function makeEnsemble(names,{minVotes=1,stopPct=12,maxDays=20,filter=null,id='ensemble'}={}){
 return {id,product:'equity-delivery',warmup:210,prepare:()=>null,
  signal(s,_x,k){
   if(dow(s.d[k])!==5||!(s.val[k]>=5e7)||(filter&&!filter(s,k)))return null;
   let v=0,t=0;for(const n of names){const r=retFor(n,s,k);if(r>0){v++;t+=Math.min(r,.1);}}
   if(v<minVotes)return null;return {score:v+t/v*5,stop:s.c[k]*(1-stopPct/100),maxDays};}};
}
