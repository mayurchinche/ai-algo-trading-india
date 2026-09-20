import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('.test-build', { recursive: true });
for(const file of ['trading','mobile-alerts','foreground-alerts','backend','production-data','paper-engine','paper-funds']) {
 await build({ entryPoints: [`tests/${file}.test.ts`], outfile: `.test-build/${file}.test.mjs`, bundle: true, platform: 'node', format: 'esm', packages:'external', define: { 'import.meta.env': JSON.stringify({ DEV: true }) } });
}
for(const args of [['--test','.test-build/trading.test.mjs','.test-build/mobile-alerts.test.mjs','.test-build/foreground-alerts.test.mjs','.test-build/backend.test.mjs','.test-build/production-data.test.mjs','.test-build/paper-engine.test.mjs','.test-build/paper-funds.test.mjs'],['tests/mobile-database.mjs'],['tests/paper-database.mjs']]) {
 const run=spawnSync(process.execPath,args,{stdio:'inherit'}); if(run.status!==0) process.exit(run.status??1);
}
