export interface DecisionEvidence {
 policy:string;scope:string;signalId:string;instrumentKey:string;segment:string;asOf:string;
 decision:'NO_TRADE'|'REVIEW_REQUIRED';blockers:string[];requiredCategories:string[];snapshotHash:string;baselineStrategy:string;
 facts:{id:string;key:string;category:string;value:number|string|boolean;unit:string;sourceName:string;sourceUrl:string;publishedAt:string;observedAt:string;expiresAt:string}[];
 rejectedFacts:{id:string|null;reason:string}[];
 thesis:Record<string,unknown>|null;
}
