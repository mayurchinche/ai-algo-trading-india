// Plain-language verdicts for each investing style, read from scorecard percentiles. A criterion is a plus when
// the company ranks at or above the 70th percentile of its peers and a minus at or below the 30th (percentiles
// are already oriented so higher is better). Criteria that could not be ranked are listed with their reason,
// never counted as a plus or a minus. Verdicts describe fit with our own rules, not a recommendation.
export const VERDICT_RULES=Object.freeze({plusAt:70,minusAt:30,strongFitAt:70,weakFitAt:30});

const item=c=>({metric:c.metric,label:c.label,value:c.value,percentile:c.percentile,weight:c.weight});

export function styleVerdict(style){
 const criteria=style?.criteria??[],ranked=criteria.filter(c=>c.status==='RANKED'&&Number.isFinite(c.percentile));
 const plus=ranked.filter(c=>c.percentile>=VERDICT_RULES.plusAt).sort((a,b)=>b.percentile-a.percentile).map(item);
 const minus=ranked.filter(c=>c.percentile<=VERDICT_RULES.minusAt).sort((a,b)=>a.percentile-b.percentile).map(item);
 const unavailable=criteria.filter(c=>!ranked.includes(c)).map(c=>({metric:c.metric,label:c.label,reason:c.status}));
 const scored=style?.status==='SCORED'&&Number.isFinite(style.score);
 const fit=!scored?'NOT_SCORED':style.score>=VERDICT_RULES.strongFitAt?'STRONG_FIT':style.score<=VERDICT_RULES.weakFitAt?'WEAK_FIT':'PARTIAL_FIT';
 return {id:style?.id,label:style?.label,status:style?.status??'UNAVAILABLE',score:scored?style.score:null,fit,plus,minus,neutral:ranked.length-plus.length-minus.length,unavailable};
}

export const styleVerdicts=company=>(company?.styles??[]).map(styleVerdict);

const FIT_WORDS={STRONG_FIT:'strong fit',PARTIAL_FIT:'partial fit',WEAK_FIT:'weak fit',NOT_SCORED:'not scored (too few ranked inputs)'};
// One sentence per style, e.g. "Value: partial fit (54). Plus: ROE (top 12%). Minus: P/E (bottom 20%)."
export function verdictSentence(v){
 const top=c=>`${c.label} (top ${Math.max(1,Math.round(100-c.percentile))}%)`,bottom=c=>`${c.label} (bottom ${Math.max(1,Math.round(c.percentile))}%)`;
 const parts=[`${v.label}: ${FIT_WORDS[v.fit]}${v.score===null?'':` (${Math.round(v.score)})`}.`];
 if(v.plus.length)parts.push(`Plus: ${v.plus.map(top).join(', ')}.`);
 if(v.minus.length)parts.push(`Minus: ${v.minus.map(bottom).join(', ')}.`);
 if(v.unavailable.length)parts.push(`Not ranked: ${v.unavailable.map(u=>u.label).join(', ')}.`);
 return parts.join(' ');
}
