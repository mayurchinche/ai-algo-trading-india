import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {portfolioCoverage} from '../server/portfolioCoverage.js';
import {PortfolioCoveragePanel} from '../src/components/PortfolioCoveragePanel';
const candidate=(symbol:string,status:string,ids:string[],blockers:string[]=[])=>({symbol,instrumentKey:'NSE_EQ|'+symbol,financialResearch:{status,documentIds:ids},blockers});
test('no candidates yields unavailable coverage, never zero or full coverage',()=>{const c=portfolioCoverage([]);assert.equal(c.coveragePct,null);assert.equal(c.status,'NO_CANDIDATES');assert(renderToStaticMarkup(createElement(PortfolioCoveragePanel,{coverage:c})).includes('cannot be measured'));});
test('coverage counts candidates, not revisions, and lists exact evidence gaps',()=>{
 const c=portfolioCoverage([candidate('AAA','MATCHED_REQUIRES_REVIEW',['original','revision']),candidate('BBB','NO_MATCH_IN_SAMPLE',[]),candidate('CCC','SOURCE_UNAVAILABLE',[])]);
 assert.equal(c.coveragePct,33.33);assert.equal(c.linkedFilingCount,2);assert.equal(c.matchedCandidateCount,1);assert.deepEqual(c.gaps.map((g:any)=>g.status),['NO_MATCH_IN_SAMPLE','SOURCE_UNAVAILABLE']);
 const html=renderToStaticMarkup(createElement(PortfolioCoveragePanel,{coverage:c}));assert(html.includes('1 of 3 candidates'));assert(html.includes('BBB'));assert(html.includes('SOURCE_UNAVAILABLE'.replaceAll('_',' ').toLowerCase()));
});
test('exclusion reasons count a candidate once per reason, and all links do not imply analysis completeness',()=>{
 const c=portfolioCoverage([candidate('AAA','MATCHED_REQUIRES_REVIEW',['a'],['RISK','RISK','NEWS']),candidate('BBB','MATCHED_REQUIRES_REVIEW',['b'],['RISK'])]);
 assert.deepEqual(c.blockers,[{reason:'RISK',count:2},{reason:'NEWS',count:1}]);assert.equal(c.coveragePct,100);assert(c.note.includes('does not measure financial completeness'));
});
test('historical reports do not invent coverage and empty matches remain gaps',()=>{assert(renderToStaticMarkup(createElement(PortfolioCoveragePanel,{})).includes('did not record'));assert.equal(portfolioCoverage([candidate('AAA','MATCHED_REQUIRES_REVIEW',[])]).matchedCandidateCount,0);});
