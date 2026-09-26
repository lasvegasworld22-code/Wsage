import { useSearchParams } from 'react-router-dom';
import { walletAgent } from '../lib/agentIdentity';
import { Modal } from '../components/Primitives';
import { AgentModuleTabs } from '../components/AgentModuleTabs';
import Profile from './Profile';
import Discover from './Discover';

export default function AgentModule(props){
 const own=walletAgent(props.world.agents,props.wallet),[params,setParams]=useSearchParams();
 const selected=own&&params.get('view')!=='explore'?'mine':'explore';
 function select(view){setParams(view==='explore'?{view:'explore'}:{});}
 return <Modal title={own&&selected==='mine'?'My agent':'The inhabitants'} subtitle="AGENT PLAZA / AGENT WORKSPACE" id="agent-module" wide onClose={()=>props.navigate('/')}>
  {own&&<AgentModuleTabs selected={selected} onSelect={select}/>}
  {selected==='mine'&&own?<Profile {...props} id={own.id} embedded/>:<Discover {...props} embedded/>}
 </Modal>;
}