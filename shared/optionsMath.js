// Black-Scholes-Merton pricing, implied volatility and Greeks for European options (NSE index options are
// European). Inputs: spot S, strike K, years to expiry T, risk-free rate r and dividend yield q (continuous).
export const OPTIONS_MATH_VERSION='bsm-v1';
const SQRT2PI=Math.sqrt(2*Math.PI);
export const normPdf=x=>Math.exp(-x*x/2)/SQRT2PI;
// Abramowitz–Stegun 7.1.26 via erf; absolute error below 1.5e-7.
export function normCdf(x){
 const z=Math.abs(x)/Math.SQRT2,t=1/(1+0.3275911*z);
 const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-z*z);
 return x>=0?(1+erf)/2:(1-erf)/2;
}
function check({S,K,T,r,q,sigma},needSigma=true){
 if(![S,K,T,r,q].every(Number.isFinite)||S<=0||K<=0||T<=0)throw new RangeError('S, K and T must be positive finite numbers');
 if(needSigma&&!(sigma>0&&Number.isFinite(sigma)))throw new RangeError('sigma must be positive');
}
const d12=({S,K,T,r,q,sigma})=>{const v=sigma*Math.sqrt(T),d1=(Math.log(S/K)+(r-q+sigma*sigma/2)*T)/v;return [d1,d1-v];};
export function bsPrice(type,p){
 check(p);const {S,K,T,r,q}=p,[d1,d2]=d12(p);
 return type==='CE'?S*Math.exp(-q*T)*normCdf(d1)-K*Math.exp(-r*T)*normCdf(d2):K*Math.exp(-r*T)*normCdf(-d2)-S*Math.exp(-q*T)*normCdf(-d1);
}
// Theta per calendar day, vega and rho per 1 percentage point.
export function bsGreeks(type,p){
 check(p);const {S,K,T,r,q,sigma}=p,[d1,d2]=d12(p),eq=Math.exp(-q*T),er=Math.exp(-r*T),pdf=normPdf(d1);
 const call=type==='CE';
 const theta=(-S*eq*pdf*sigma/(2*Math.sqrt(T))+(call?q*S*eq*normCdf(d1)-r*K*er*normCdf(d2):-q*S*eq*normCdf(-d1)+r*K*er*normCdf(-d2)))/365;
 return {delta:call?eq*normCdf(d1):eq*(normCdf(d1)-1),gamma:eq*pdf/(S*sigma*Math.sqrt(T)),theta,vega:S*eq*pdf*Math.sqrt(T)/100,rho:(call?K*T*er*normCdf(d2):-K*T*er*normCdf(-d2))/100};
}
export function arbitrageBounds(type,{S,K,T,r,q}){
 const fs=S*Math.exp(-q*T),fk=K*Math.exp(-r*T);
 return type==='CE'?{lower:Math.max(0,fs-fk),upper:fs}:{lower:Math.max(0,fk-fs),upper:fk};
}
// Bisection: price is monotonic in sigma, so the root is unique when the price lies within the bounds.
export function impliedVolatility(type,price,p,{low=1e-4,high=5,tolerance=1e-6,maxIterations=200}={}){
 check(p,false);
 if(!(price>0&&Number.isFinite(price)))return {status:'INVALID_PRICE',iv:null};
 const b=arbitrageBounds(type,p);
 if(price<=b.lower||price>=b.upper)return {status:'OUTSIDE_ARBITRAGE_BOUNDS',iv:null,bounds:b};
 const f=s=>bsPrice(type,{...p,sigma:s})-price;
 if(f(low)>0||f(high)<0)return {status:'OUTSIDE_SOLVER_RANGE',iv:null};
 let lo=low,hi=high;
 for(let i=0;i<maxIterations;i++){const mid=(lo+hi)/2,v=f(mid);if(Math.abs(v)<tolerance||hi-lo<1e-10)return {status:'SOLVED',iv:mid};if(v>0)hi=mid;else lo=mid;}
 return {status:'SOLVED',iv:(lo+hi)/2};
}
// NSE equity and index derivatives expire at 15:30 IST on the expiry date.
export const yearsToExpiry=(expiryDate,now)=>(Date.parse(expiryDate+'T15:30:00+05:30')-now)/(365*86400000);
