// node research/team/monitor.mjs [--rounds 8] [--model m]  Runs loop.mjs and supervises it: a stall watchdog (no log activity),
// a tamper check on protected files, and a periodic `copilot -p` MONITOR agent that writes docs/team/MONITOR.md.
// STOP from the monitor agent (or tampering/stall) kills the loop.
import {spawn,spawnSync,execSync} from 'node:child_process';
import {readFileSync,readdirSync,statSync,existsSync,mkdirSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {HERE,STATE,sha} from './gates.mjs';
const ROOT=join(HERE,'..','..'),MON=join(ROOT,'docs','team','MONITOR.md'),LOG=join(STATE,'monitor.log'),GATES=join(HERE,'gates.mjs'),h0=sha(GATES);
const STALL_MIN=Number(process.env.STALL_MIN||45),AGENT_EVERY_MIN=Number(process.env.AGENT_EVERY_MIN||20),TICK_MS=Number(process.env.TICK_MS||60000);
mkdirSync(STATE,{recursive:true});mkdirSync(join(ROOT,'docs','team'),{recursive:true});
const log=m=>{const l=new Date().toISOString()+' '+m;console.log(l);appendFileSync(LOG,l+'\n');};
const child=spawn('node',['--max-old-space-size=6000',join(HERE,'loop.mjs'),...process.argv.slice(2)],{cwd:ROOT,stdio:'inherit'});
let done=false,lastAgent=Date.now();child.on('exit',c=>{done=true;log('loop exited '+c);});
const latest=()=>Math.max(0,...readdirSync(STATE).filter(f=>/^r\d+-.*\.log$/.test(f)||f==='ledger.json').map(f=>statSync(join(STATE,f)).mtimeMs));
const stop=why=>{log('STOP: '+why);child.kill('SIGTERM');done=true;};
const PROT=/^(research\/team\/(gates|evaluate|loop|monitor)\.mjs|research\/lib\/|server\/|api\/|src\/|shared\/)/;
const t=setInterval(()=>{
 if(done){clearInterval(t);return;}
 try{
  if(sha(GATES)!==h0||execSync('git status --porcelain',{cwd:ROOT,encoding:'utf8'}).split('\n').some(l=>PROT.test(l.slice(3))))return stop('protected file changed');
  const idle=(Date.now()-Math.max(latest(),lastAgent-AGENT_EVERY_MIN*6e4))/6e4;
  if(latest()&&(Date.now()-latest())/6e4>STALL_MIN)return stop(`no activity for ${STALL_MIN} min (stalled)`);
  if((Date.now()-lastAgent)/6e4>=AGENT_EVERY_MIN&&idle>=0){lastAgent=Date.now();log('monitor agent review');
   spawnSync('copilot',['-p',readFileSync(join(HERE,'roles','monitor.md'),'utf8'),'--allow-all-tools','--no-ask-user','--autopilot','--max-autopilot-continues','10'],{cwd:ROOT,encoding:'utf8',timeout:15*6e4});
   if(existsSync(MON)&&/verdict:?\s*\**STOP/i.test(readFileSync(MON,'utf8')))stop('monitor agent verdict STOP');}
 }catch(e){log('monitor error '+e.message);}
},TICK_MS);
