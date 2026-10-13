export const BUSINESS_RESEARCH_POLICY:string;
export interface ResearchPillar {id:string;title:string;category:string;fields:string[][]}
export const researchPillars:ResearchPillar[];
export function sectorResearchFields(sector:unknown):{profile:string;category:string;fields:string[][]};
export interface BusinessResearchReport {policy:string;status:string;sectorProfile:string;blockers:string[];pillars:{id:string;title:string;status:string;outlook:string|null;fields:{key:string;label:string;status:string;text:string|null;factIds:string[]}[]}[]}
