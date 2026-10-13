export function portfolioCoverage(assessments){
 const matched=assessments.filter(a=>a.financialResearch?.status==='MATCHED_REQUIRES_REVIEW'&&a.financialResearch.documentIds.length>0);
 const gaps=assessments.filter(a=>!matched.includes(a)).map(a=>({instrumentKey:a.instrumentKey,symbol:a.symbol,status:a.financialResearch?.status||'NOT_RECORDED'}));
 const blockers=new Map();
 for(const candidate of assessments)for(const reason of new Set(candidate.blockers))blockers.set(reason,(blockers.get(reason)||0)+1);
 return {policy:'portfolio-coverage-v1',candidateCount:assessments.length,matchedCandidateCount:matched.length,linkedFilingCount:new Set(matched.flatMap(a=>a.financialResearch.documentIds)).size,coveragePct:assessments.length?Math.round(matched.length/assessments.length*10000)/100:null,status:!assessments.length?'NO_CANDIDATES':gaps.length?'CANDIDATE_COVERAGE_GAPS':'ALL_CANDIDATES_HAVE_SAMPLE_LINKS',gaps,blockers:[...blockers].map(([reason,count])=>({reason,count})).sort((a,b)=>b.count-a.count||a.reason.localeCompare(b.reason)),note:'Coverage counts candidates with at least one linked filing in the saved sample. It does not measure financial completeness, data freshness, analysis quality or profitability.'};
}
