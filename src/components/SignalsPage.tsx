import {SharedOpportunityFeed} from './SharedOpportunityFeed';
export function SignalsPage({onOpen}:{onOpen?:(id:string)=>void}){return <SharedOpportunityFeed onOpen={onOpen}/>;}
