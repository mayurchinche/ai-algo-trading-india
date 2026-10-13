export const BUSINESS_RESEARCH_POLICY='business-research-v1';
export const researchPillars=[
 {id:'global',title:'Global opportunities and risks',category:'global',fields:[['exposure','Export, import and currency exposure'],['opportunity','Demand, trade policy and competitive opportunity'],['downside','Tariffs, geopolitical and concentration risks'],['earningsLink','Link to revenue, margins and cash flow'],['valuation','What the current valuation already assumes'],['invalidation','Catalyst timing and conditions that invalidate the thesis']]},
 {id:'orders',title:'Order book and revenue visibility',category:'orders',fields:[['commitments','Confirmed contracts, separate from bids and expectations'],['execution','Delivery schedule and historical conversion'],['economics','Margins, capacity and working-capital requirements'],['collections','Customer concentration, payments and cancellation risk']]},
 {id:'management',title:'Management behaviour',category:'management',fields:[['delivery','Past guidance compared with actual delivery'],['allocation','Capital allocation, dilution and cash conversion'],['ownership','Promoter ownership, pledging and related parties'],['governance','Auditors, leadership changes and governance concerns']]},
];
export function sectorResearchFields(sector){
 const normalized=typeof sector==='string'?sector.normalize('NFKC').trim().toLowerCase():'';
 if(['banking','banks'].includes(normalized))return {profile:'banking',category:'banking',fields:[['growth','Loan growth and asset quality'],['funding','Deposit franchise and funding costs'],['capital','Capital adequacy and provisioning']]};
 if(normalized==='insurance')return {profile:'insurance',category:'insurance',fields:[['growth','Premium growth and business mix'],['retention','Renewals and persistency'],['capital','Solvency and underwriting economics']]};
 return {profile:'orders',category:'orders',fields:researchPillars[1].fields};
}
