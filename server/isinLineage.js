// ISIN lineage after share splits and consolidations. A company's earlier filings can carry the ISIN in use before
// a face-value change (NSDL issues a new serial for the same issuer). Such a filing is accepted for the current ISIN
// only when every check holds:
//  1. both ISINs are valid (check digit), issued to a company (type E) with the same 4-character issuer code,
//     both for fully paid equity shares (security code 01), and the filed serial is lower than the current one;
//  2. the filing's own symbol equals the requested symbol;
//  3. NSE's corporate actions for that symbol list a face-value split or consolidation whose ex-date falls after
//     the filing was published and no later than now.
// Per-share and share-count facts in such a filing predate the corporate action, so they are removed (recorded as
// unavailable); totals such as revenue, profit and equity are unaffected and kept.
import {createHash} from 'node:crypto';
import {companySymbol} from './companyHistory.js';
export const LINEAGE_POLICY='isin-lineage-v1';
export const corporateActionsUrl=symbol=>'https://www.nseindia.com/api/corporates-corporateActions?index=equities&symbol='+encodeURIComponent(companySymbol(symbol));
const PER_SHARE_KEYS=['basicEps','faceValue','paidUpEquityCapital'];
const MONTHS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// ISIN check digit: letters become numbers (A=10 … Z=35), then the Luhn algorithm over the digit string.
export function validIsin(isin){
 if(typeof isin!=='string'||!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin))return false;
 const digits=[...isin.slice(0,11)].map(c=>/\d/.test(c)?c:String(c.charCodeAt(0)-55)).join('');
 let sum=0;for(let i=0;i<digits.length;i++){let d=Number(digits[digits.length-1-i]);if(i%2===0){d*=2;if(d>9)d-=9;}sum+=d;}
 return (10-sum%10)%10===Number(isin[11]);
}
// IN + issuer type + 4-character issuer code + 2-character security code + 2-character serial + check digit.
export const isinParts=isin=>validIsin(isin)&&isin.startsWith('IN')?{issuerType:isin[2],issuer:isin.slice(3,7),security:isin.slice(7,9),serial:isin.slice(9,11)}:null;
export function sameIssuerEquity(former,current){
 const a=isinParts(former),b=isinParts(current);
 return !!a&&!!b&&former!==current&&a.issuerType==='E'&&b.issuerType==='E'&&a.issuer===b.issuer&&a.security==='01'&&b.security==='01'&&a.serial<b.serial;
}

const exDateOf=v=>{const m=/^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(String(v??''));if(!m)return null;const i=MONTHS.indexOf(m[2].toUpperCase());if(i<0)return null;
 const d=`${m[3]}-${String(i+1).padStart(2,'0')}-${m[1]}`;return new Date(d).toISOString().slice(0,10)===d?d:null;};
// Face-value changes only; dividends, bonuses alone and rights issues do not change the ISIN.
export function parseCorporateActions(body,symbol,now){
 const rows=JSON.parse(body);if(!Array.isArray(rows))throw Error('Invalid corporate actions');
 const today=new Date(now+19800000).toISOString().slice(0,10),actions=[];
 for(const r of rows){
  const subject=typeof r?.subject==='string'?r.subject.trim():'',exDate=exDateOf(r?.exDate);
  if(r?.symbol!==symbol||!exDate||exDate>today||!/face value split|sub-?division|consolidation/i.test(subject))continue;
  actions.push({subject,exDate});
 }
 return {source:corporateActionsUrl(symbol),sourceHash:createHash('sha256').update(body).digest('hex'),actions:actions.sort((a,b)=>a.exDate.localeCompare(b.exDate))};
}

// Returns {filing} re-keyed to the current ISIN with its lineage recorded, or {reason} when a check fails.
export function relinkFormerIsin(filing,{symbol,currentIsin,corporateActions}){
 const filedIsin=filing.instrumentKey.replace(/^NSE_EQ\|/,'');
 if(filing.symbol!==symbol)return {reason:'FILED_SYMBOL_DIFFERS'};
 if(!sameIssuerEquity(filedIsin,currentIsin))return {reason:'NOT_SAME_ISSUER_EQUITY'};
 const published=new Date(Date.parse(filing.publishedAt)+19800000).toISOString().slice(0,10);
 const action=corporateActions?.actions.find(a=>a.exDate>published);
 if(!action)return {reason:'NO_FACE_VALUE_CHANGE_AFTER_FILING'};
 const strip=list=>list.map(x=>({...x,facts:x.facts.filter(f=>!PER_SHARE_KEYS.includes(f.key)),
  unavailable:[...x.unavailable.filter(u=>!PER_SHARE_KEYS.includes(u.key)),...x.facts.filter(f=>PER_SHARE_KEYS.includes(f.key)).map(f=>({key:f.key,status:'BEFORE_FACE_VALUE_CHANGE',tag:f.tag}))]}));
 return {filing:{...filing,instrumentKey:'NSE_EQ|'+currentIsin,identityBasis:'FORMER_ISIN_SAME_ISSUER',periods:strip(filing.periods),positions:strip(filing.positions),
  lineage:{policy:LINEAGE_POLICY,filedIsin,currentIsin,corporateAction:{...action,source:corporateActions.source,sourceHash:corporateActions.sourceHash}}}};
}
