// Explicit UI test fixture; not imported by the production application or build.
import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {PaperExecutionPanel} from '../src/components/PaperExecutionPanel';
import {newPaperAccount} from '../server/paperEngine.js';
import {advanceWorkflow,configureExecution,reviewIntent} from '../server/paperWorkflow.js';
import '../src/index.css';
const now=Date.now(),at=new Date(now).toISOString();
const initial=advanceWorkflow(configureExecution(newPaperAccount(),{mode:'MANUAL',delaySeconds:0},now).state,{now,candidates:[{signalId:'TEST-ONLY',symbol:'SYNTHETIC UI TEST',side:'BUY',score:80,signalTime:at,signalPrice:100,signalQuoteTime:at,stop:99,target:104}],quotes:[],marketOpen:true,acceptEntries:true}).state;
export function Test(){const[state,setState]=useState(initial),[message,setMessage]=useState('');return <main style={{padding:16,maxWidth:800,margin:'auto'}}><h1>UI TEST ONLY — synthetic signal</h1><p>No user storage, network or brokerage access.</p><PaperExecutionPanel settings={state.execution} intents={state.intents} disabled={false} onAction={async action=>{try{const next=action.execution?configureExecution(state,action.execution):reviewIntent(state,action.reviewIntent);setState(next.state);setMessage('Saved test-only action');return true;}catch(e){setMessage((e as Error).message);return false;}}}/><p role="status">{message}</p></main>}
createRoot(document.getElementById('root')!).render(<Test/>);
