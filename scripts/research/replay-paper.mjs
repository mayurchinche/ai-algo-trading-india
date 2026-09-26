import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {replayPaper} from '../../server/paperReplay.js';
 const [input,output]=process.argv.slice(2);if(!input||!output)throw new Error('Usage: node scripts/research/replay-paper.mjs <recording.json> <report.json>');
 const raw=await readFile(input,'utf8'),recording=JSON.parse(raw);
 const sourceFiles=['server/paperEngine.js','server/paperWorkflow.js','server/paperCosts.js','server/paperFunds.js','server/paperPerformance.js','server/paperReplay.js','scripts/research/replay-paper.mjs'];
 const hash=v=>createHash('sha256').update(v).digest('hex');
 const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,hash(await readFile(new URL('../../'+p,import.meta.url)))])));
 await writeFile(output,JSON.stringify({inputSha256:hash(raw),sourceHashes,runs:[0,30,60].map(delay=>replayPaper(recording,delay))},null,2));
