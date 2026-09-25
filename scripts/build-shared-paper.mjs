import { build } from 'esbuild';
import assert from 'node:assert/strict';
// Vercel runs native ESM: bundle the scanner's extensionless TS dependency graph.
await build({entryPoints:['server/sharedPaperObservation.ts'],outfile:'server/sharedPaperObservation.bundle.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {observeSharedPaper}=await import('../server/sharedPaperObservation.bundle.mjs');
assert.equal(typeof observeSharedPaper,'function');
console.log('Shared paper server bundle imports successfully in Node');
