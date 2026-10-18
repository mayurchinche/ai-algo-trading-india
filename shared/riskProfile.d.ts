export type RiskLevel = 'CONSERVATIVE' | 'BALANCED' | 'GROWTH';
export type QuestionId = 'horizon' | 'drawdown' | 'reliance' | 'experience';
export interface RiskQuestion { id: QuestionId; question: string; options: readonly string[] }
export interface ProfileLimits { label: string; maxStockPct: number; maxTopFivePct: number; maxSectorPct: number; minHoldings: number; maxPositions: number; cashReservePct: number; riskBudgetPct: number }
export type RiskAssessment =
 | { version: string; status: 'INCOMPLETE'; missing: QuestionId[] }
 | { version: string; status: 'ASSESSED'; profile: RiskLevel; label: string; limits: ProfileLimits; limitedBy: QuestionId[]; tensions: { question: QuestionId; answer: string; limitedBy: QuestionId[] }[]; answers: Partial<Record<QuestionId, number>>; note: string };
export const RISK_PROFILE_VERSION: string;
export const LEVELS: readonly RiskLevel[];
export const QUESTIONS: readonly RiskQuestion[];
export const PROFILE_LIMITS: Readonly<Record<RiskLevel, ProfileLimits>>;
export function assessRiskProfile(answers: Partial<Record<string, number>>): RiskAssessment;
export function mandateLimits(profile: RiskLevel): { maxStockPct: number; maxSectorPct: number; cashReservePct: number; maxPositions: number; riskBudgetPct: number };
