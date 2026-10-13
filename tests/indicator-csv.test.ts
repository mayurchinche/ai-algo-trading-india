import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {IndicatorCsvInspector} from '../src/components/IndicatorCsvInspector';
import {inspectIndicatorCsv,MAX_INDICATOR_CSV_BYTES} from '../src/utils/inspectIndicatorCsv';
// Synthetic parser fixtures, not market observations or indicator signals.
test('CSV preserves zero, missing and nonnumeric values separately',()=>{
 const result=inspectIndicatorCsv('\uFEFFtime,plot\r\n2026-01-01,0\r\n2026-01-02,\r\n2026-01-03,NaN\r\n2026-01-04,-1.5e2\r\n');
 assert.equal(result.rows,4);assert.deepEqual(result.columns[1],{name:'plot',numeric:2,missing:1,text:1,minimum:-150,maximum:0});
});
test('CSV supports quoted commas, escaped quotes and newlines',()=>{
 const result=inspectIndicatorCsv('"Plot, name",notes\n1,"a ""quote""\nand newline"');
 assert.equal(result.rows,1);assert.equal(result.columns[0].name,'Plot, name');assert.equal(result.columns[1].text,1);
});
test('CSV rejects malformed data instead of silently dropping records',()=>{
 for(const source of ['a,a\n1,2','a,\n1,2','a,b\n1','a\n"broken','a\n"x"bad','a\nx"x','a\n',''])assert.throws(()=>inspectIndicatorCsv(source));
});
test('CSV bounds file size, columns and row count',()=>{
 assert.throws(()=>inspectIndicatorCsv('x'.repeat(MAX_INDICATOR_CSV_BYTES+1)),/5 MB/);
 assert.throws(()=>inspectIndicatorCsv(Array.from({length:201},(_,i)=>`c${i}`).join(',')+'\n1'),/200 columns/);
 assert.throws(()=>inspectIndicatorCsv('a\n'+'1\n'.repeat(50001)),/50,000/);
});
test('CSV treats formulas, infinity and hexadecimal as text',()=>{
 const result=inspectIndicatorCsv('plot\n=1+1\nInfinity\n0xff\n1e999\n');
 assert.equal(result.columns[0].text,4);assert.equal(result.columns[0].minimum,null);
});
test('CSV inspector explains local-only processing and validation limits',()=>{
 const html=renderToStaticMarkup(createElement(IndicatorCsvInspector));
 assert.match(html,/not uploaded or saved/);assert.match(html,/No performance result or trading decision/);assert.match(html,/type="file"/);
});

import {inspectCsvTimes} from '../src/utils/inspectCsvTimes';
test('timestamps normalize equivalent offsets and count duplicate instants',()=>{
 const report=inspectCsvTimes(['2026-01-02T09:15:00+05:30','2026-01-02T03:45:00Z'],'iso-offset');
 assert.equal(report.duplicates,1);assert.equal(report.valid,2);assert.equal(report.earliest,'2026-01-02T03:45:00.000Z');
});
test('timestamps reject impossible dates and missing timezone without normalization',()=>{
 const report=inspectCsvTimes(['2025-02-29T00:00:00Z','2026-04-31T00:00:00Z','2026-01-02','2026-01-02T09:15:00','2026-01-02T24:00:00Z','2026-01-02T09:15:00+24:00','2024-02-29T00:00:00Z',''],'iso-offset');
 assert.equal(report.invalid,6);assert.equal(report.blank,1);assert.equal(report.valid,1);
});
test('timestamp ordering preserves input and exposes backwards records across invalid values',()=>{
 const values=['2000','invalid','1000','1000',''];
 const report=inspectCsvTimes(values,'unix-milliseconds');
 assert.equal(report.backward,1);assert.equal(report.duplicates,1);assert.equal(report.invalid,1);assert.equal(report.blank,1);
 assert.equal(report.earliest,'1970-01-01T00:00:01.000Z');assert.equal(values[0],'2000');
});
test('timestamp units are explicit and numeric overflow is rejected',()=>{
 assert.equal(inspectCsvTimes(['1000'],'unix-seconds').latest,'1970-01-01T00:16:40.000Z');
 assert.equal(inspectCsvTimes(['1.5','1e3','Infinity','999999999999999999'],'unix-seconds').invalid,4);
 assert.equal(inspectCsvTimes(['bad'],'iso-offset').earliest,null);
});
