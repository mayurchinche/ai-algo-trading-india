// Shared taxonomy. Budgets are simulation defaults, not profitability claims.
export const tradingSegments = Object.freeze([
 {id:'intraday',label:'Intraday',accountId:'user1',capital:10000,executionReady:true},
 {id:'short-term',label:'Short term',accountId:'user1:short-term',capital:20000,executionReady:false},
 {id:'long-term',label:'Long term',accountId:'user1:long-term',capital:20000,executionReady:false},
 {id:'options',label:'Options',accountId:'user1:options',capital:50000,executionReady:false},
 {id:'futures',label:'Futures',accountId:'user1:futures',capital:50000,executionReady:false},
]);
export const tradingSegment = id => tradingSegments.find(segment=>segment.id===id);
