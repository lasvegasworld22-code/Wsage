import { useEffect,useState } from 'react';
import { ChevronDown, ChevronUp, Check, LoaderCircle, ArrowRight, Radio } from 'lucide-react';
import { MISSION_STAGES } from '../hooks/useMissionTracker';

export const MissionTracker=({missions,ready,navigate})=>{
 const [index,setIndex]=useState(0),[expanded,setExpanded]=useState(false),[now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const m=missions[index%Math.max(1,missions.length)];
 if(!m)return ready.length?<button className="mission-ready-toast" data-testid="mission-ready-notice" onClick={()=>navigate('/missions/'+ready[0].id)}>{ready[0].agentName} · report ready<ArrowRight size={15}/></button>:null;
 const status=m.status==='SETTLING'?'GENERATING OUTPUT':m.status,step=Math.max(0,MISSION_STAGES.indexOf(status));
 const seconds=Math.max(0,Math.floor((now-new Date(m.startedAt))/1000)),target=m.targetDurationSeconds;
 return <aside className={'mission-tracker '+(expanded?'expanded':'')} data-testid="mission-tracker">
  <header><span className="tracker-icon"><Radio size={18}/></span><div><span className="tracker-agent" data-testid="tracker-agent">{m.agentName} is working</span><strong data-testid="tracker-current-stage">{status}</strong></div><span className="tracker-elapsed" data-testid="tracker-elapsed">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</span><button data-testid="tracker-toggle" onClick={()=>setExpanded(!expanded)} aria-label={expanded?'Collapse mission flow':'Expand mission flow'}>{expanded?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button></header>
  <p className="tracker-detail" data-testid="tracker-detail">{m.phaseDetail||'Your agent has received the objective.'}</p>
  {target&&<p className="tracker-timing" data-testid="tracker-timing">{m.researchDepth==='deep'?'Deep search':m.researchDepth==='quick'?'Quick research':'Standard research'} · Target {Math.floor(target/60)}m {target%60}s · 5m limit</p>}
  <div className="tracker-progress" data-testid="tracker-progress">{MISSION_STAGES.map((s,i)=><span key={s} title={s} className={i<step?'done':i===step?'current':''}/>)}</div>
  <ol className="tracker-flow">{MISSION_STAGES.map((s,i)=><li data-testid={'tracker-step-'+i} key={s} className={i<step?'done':i===step?'current':''}><span>{i<step?<Check size={10}/>:i===step?<LoaderCircle size={10} className="spin"/>:String(i+1).padStart(2,'0')}</span>{s}</li>)}</ol>
  <footer><span data-testid="tracker-source-count">{m.sources?.length||0} sources collected</span><span data-testid="tracker-privacy">Private work feed</span>{missions.length>1&&<button data-testid="tracker-next-agent" onClick={()=>setIndex(index+1)}>+{missions.length-1} other agents<ArrowRight size={12}/></button>}</footer>
 </aside>;
};