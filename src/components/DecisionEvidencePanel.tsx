import type {DecisionEvidence} from '../../shared/decisionEvidence';
import {formatIST} from '../services/tradingTime';
export function DecisionEvidencePanel({evidence}:{evidence?:DecisionEvidence}){
 if(!evidence)return <p className="quality-note">No evidence assessment was saved with this historical signal. It will not be reconstructed using newer information.</p>;
 return <details className="notice"><summary>Evidence policy: {evidence.decision==='NO_TRADE'?'No trade':'Review required'}</summary><p>This is a separate research assessment. The existing technical baseline can still make paper trades; this assessment does not authorize orders.</p><p>Decision time: {formatIST(evidence.asOf)} · Policy: {evidence.policy}</p>
 {evidence.blockers.length>0&&<><h4>Missing or insufficient evidence</h4><ul>{evidence.blockers.map(reason=><li key={reason}>{reason.toLowerCase().replaceAll('_',' ')}</li>)}</ul></>}
 <p>{evidence.facts.length} verified facts available at that time. A later publication or revision cannot improve this saved assessment.</p>
 {evidence.facts.map(f=><p key={f.id}><a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">{f.sourceName} · {f.key}</a>: {String(f.value)} {f.unit} · Published {formatIST(f.publishedAt)} · Received {formatIST(f.observedAt)}</p>)}
 <p>Snapshot: <code style={{overflowWrap:'anywhere'}}>{evidence.snapshotHash}</code></p></details>;
}
