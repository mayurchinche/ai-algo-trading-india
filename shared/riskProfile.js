// Self-assessment that sets portfolio concentration limits. Our own rules, not a regulatory suitability
// assessment. The profile is the most cautious level among the answers: one binding constraint (for
// example, a short horizon) is never averaged away by a high loss tolerance.
export const RISK_PROFILE_VERSION='risk-profile-v1';
export const LEVELS=Object.freeze(['CONSERVATIVE','BALANCED','GROWTH']);
export const QUESTIONS=Object.freeze([
 {id:'horizon',question:'When might you need to withdraw most of this money?',options:['Within 3 years','In 3 to 7 years','After more than 7 years']},
 {id:'drawdown',question:'If this portfolio fell 30% within a year, what would you most likely do?',options:['Sell to stop further losses','Hold and wait','Hold and consider adding more']},
 {id:'reliance',question:'How much do you rely on this money?',options:['It is for essential expenses or I have little other savings','I have other savings, but would feel a large loss','It is surplus; my emergency fund and insurance are separate']},
 {id:'experience',question:'How long have you invested in individual stocks?',options:['Less than 2 years','2 to 5 years','More than 5 years, including through a large market fall']},
].map(q=>Object.freeze({...q,options:Object.freeze(q.options)})));
// Limits are within validateMandate ranges. minHoldings and maxTopFivePct are portfolio-fit checks only.
export const PROFILE_LIMITS=Object.freeze({
 CONSERVATIVE:Object.freeze({label:'Conservative',maxStockPct:8,maxTopFivePct:40,maxSectorPct:25,minHoldings:12,maxPositions:20,cashReservePct:30,riskBudgetPct:0.5}),
 BALANCED:Object.freeze({label:'Balanced',maxStockPct:12,maxTopFivePct:55,maxSectorPct:35,minHoldings:8,maxPositions:15,cashReservePct:20,riskBudgetPct:1}),
 GROWTH:Object.freeze({label:'Growth',maxStockPct:20,maxTopFivePct:75,maxSectorPct:45,minHoldings:5,maxPositions:10,cashReservePct:10,riskBudgetPct:1.5}),
});

// answers: {questionId: optionIndex}. Every question must be answered with a listed option.
export function assessRiskProfile(answers){
 if(!answers||typeof answers!=='object'||Array.isArray(answers))throw new TypeError('answers must be an object');
 const unknown=Object.keys(answers).filter(k=>!QUESTIONS.some(q=>q.id===k));if(unknown.length)throw new TypeError('Unknown question: '+unknown.join(', '));
 const missing=QUESTIONS.filter(q=>!Number.isInteger(answers[q.id])||answers[q.id]<0||answers[q.id]>=q.options.length).map(q=>q.id);
 if(missing.length)return {version:RISK_PROFILE_VERSION,status:'INCOMPLETE',missing};
 const level=Math.min(...QUESTIONS.map(q=>answers[q.id])),profile=LEVELS[level];
 const limitedBy=QUESTIONS.filter(q=>answers[q.id]===level).map(q=>q.id);
 // Answers two levels apart usually mean one constraint dominates; the user should see which.
 const tensions=QUESTIONS.filter(q=>answers[q.id]-level>=2).map(q=>({question:q.id,answer:q.options[answers[q.id]],limitedBy}));
 return {version:RISK_PROFILE_VERSION,status:'ASSESSED',profile,label:PROFILE_LIMITS[profile].label,limits:PROFILE_LIMITS[profile],limitedBy,tensions,answers:{...answers},
  note:'Self-assessment for research settings, not a suitability assessment or investment advice. The profile follows your most cautious answer.'};
}
// Mandate fields for buildResearchPortfolio; name, segment and budget stay the caller's choice.
export function mandateLimits(profile){
 const l=PROFILE_LIMITS[profile];if(!l)throw new TypeError('Unknown profile');
 return {maxStockPct:l.maxStockPct,maxSectorPct:l.maxSectorPct,cashReservePct:l.cashReservePct,maxPositions:l.maxPositions,riskBudgetPct:l.riskBudgetPct};
}
