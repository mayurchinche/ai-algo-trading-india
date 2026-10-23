// node research/team/loop.mjs [--rounds 8] [--model <m>] [--dry]
// Autonomous team: researcher → product → designer+engineer → QA, one `copilot -p` per role, looping until a strategy is
// ACCEPTED on the locked holdout (GOAL if avg ≥ 3%/mo) or MAX rounds/holdout budget is spent, then an honest report.
// Agents work on branch team/<run>; nothing is merged or touched in the live books (that needs a human: --promote is not implemented).
import {spawnSync,execSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {HERE,STATE,readLedger,writeLedger,variantCount,sha,MAX_HOLDOUT_LOOKS} from './gates.mjs';
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i<0?d:process.argv[i+1]??true;};
const ROUNDS=Number(arg('--rounds',8)),MODEL=arg('--model',null),DRY=process.argv.includes('--dry');
const ROOT=join(HERE,'..','..'),DOCS=join(ROOT,'docs','team'),GATES=join(HERE,'gates.mjs'),gatesHash=sha(GATES);
mkdirSync(DOCS,{recursive:true});mkdirSync(STATE,{recursive:true});
const sh=c=>execSync(c,{cwd:ROOT,encoding:'utf8'}).trim();
const branch='team/'+new Date().toISOString().slice(0,10);
if(!DRY){try{sh(`git checkout -B ${branch}`);}catch(e){console.error('cannot create branch',e.message);process.exit(1);}}
const prompt=(role,round,extra='')=>`${readFileSync(join(HERE,'roles',role+'.md'),'utf8')}\n\nROUND ${round} of ${ROUNDS}. Repo: ${ROOT}. Shared rules: research/team/README.md. Ledger: research/team/state/ledger.json (variants so far: ${variantCount(readLedger())}). ${extra}`;
const run=(role,round,extra)=>{
 console.log(`[round ${round}] ${role}…`);if(DRY)return;
 const a=['-p',prompt(role,round,extra),'--allow-all-tools','--no-ask-user','--autopilot','--max-autopilot-continues','30'];if(MODEL)a.push('--model',MODEL);
 const r=spawnSync('copilot',a,{cwd:ROOT,encoding:'utf8',timeout:60*60*1000,maxBuffer:1<<26});
 writeFileSync(join(STATE,`r${round}-${role}.log`),(r.stdout||'')+(r.stderr||''));
 if(r.status!==0)console.error(`${role} exited ${r.status}`);
};
const PROTECTED=/^(research\/team\/(gates|evaluate|loop)\.mjs|research\/lib\/|server\/|api\/|src\/|shared\/)/;
const tampered=()=>sha(GATES)!==gatesHash||sh('git status --porcelain').split('\n').some(l=>PROTECTED.test(l.slice(3)));
let outcome='ROUNDS_EXHAUSTED';
for(let round=1;round<=ROUNDS;round++){
 run('researcher',round);run('product',round);run('designer',round);run('engineer',round);run('qa',round);
 if(DRY)continue;
 if(tampered()){outcome='ABORTED_GATE_TAMPERING';break;}
 const l=readLedger(),looks=l.holdoutLooks,best=looks.find(h=>h.goal)||looks.find(h=>h.accepted);
 l.rounds.push({round,variants:variantCount(l),looks:looks.length});writeLedger(l);
 try{sh(`git add -A docs/team research/strategies/candidates && git commit -m "Team round ${round}: research, candidates and QA notes" --allow-empty`);}catch{}
 if(best?.goal){outcome='GOAL_REACHED';break;}
 if(best){outcome='ACCEPTED_BELOW_GOAL';if(round>=ROUNDS)break;}
 if(looks.length>=MAX_HOLDOUT_LOOKS){outcome='HOLDOUT_BUDGET_SPENT';break;}
}
const l=readLedger();
writeFileSync(join(DOCS,'FINAL.md'),`# Team result: ${outcome}\n\n- Variants tried (incl. ${l.priorVariants} before the team): ${variantCount(l)}\n- Holdout looks: ${l.holdoutLooks.length}/${MAX_HOLDOUT_LOOKS}\n\n${l.holdoutLooks.map(h=>`- ${h.id}: accepted=${h.accepted} goal=${h.goal} ${JSON.stringify(h.holdout)}`).join('\n')||'No strategy reached the holdout.'}\n\nPer-round notes: docs/team/round-*.md. Not merged to main; a human decides promotion.\n`);
console.log('outcome',outcome);
