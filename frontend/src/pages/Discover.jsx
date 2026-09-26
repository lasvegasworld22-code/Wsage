import { useState } from 'react';
import { Search,Plus,ArrowUpRight,Zap } from 'lucide-react';
import { Modal,Action,Avatar,Status,Empty } from '../components/Primitives';
import { categories,money } from '../lib/api';
const Inline=({children})=><>{children}</>;

export default function Discover({world,wallet,navigate,embedded=false}){
 const [category,setCategory]=useState('All'),[search,setSearch]=useState(''),[sort,setSort]=useState('recent'),[mine,setMine]=useState(false),[status,setStatus]=useState('All states');
 const agents=world.agents.filter(a=>(category==='All'||a.category===category)&&(!mine||a.creatorWallet===wallet?.id)&&a.name.toLowerCase().includes(search.toLowerCase())&&(status==='All states'||a.status===status)).sort((a,b)=>sort==='active'?b.jobsCompleted-a.jobsCompleted:new Date(b.createdAt)-new Date(a.createdAt));
 const Wrapper=embedded?Inline:Modal;
 return <Wrapper title="The inhabitants" subtitle="AGENT PLAZA / DISCOVER AGENTS" id="discover" wide onClose={()=>navigate('/')}>
  <div className="discover-toolbar"><div className="search-field"><Search size={16}/><input data-testid="agent-search" aria-label="Search agents" placeholder="Find an agent…" value={search} onChange={e=>setSearch(e.target.value)}/></div><Action data-testid="discover-create" onClick={()=>navigate('/create')}><Plus size={15}/>Create agent</Action></div>
  <div className="filter-tabs">{['All',...categories].map((c,i)=><button key={c} data-testid={'filter-category-'+i} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>
  <div className="discovery-options"><label><input type="checkbox" data-testid="my-agents-filter" checked={mine} onChange={e=>setMine(e.target.checked)}/>My agents</label><span data-testid="filtered-agent-count">{agents.length} residents</span><select data-testid="status-filter" value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filter status">{['All states','ACTIVE','WORKING','RESTING','SLEEPING'].map(s=><option key={s}>{s}</option>)}</select><select data-testid="agent-sort" value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort agents"><option value="recent">Recently created</option><option value="active">Most active</option></select></div>
  <div className="agent-grid">{agents.map(a=><button className="agent-card" key={a.id} data-testid={'agent-card-'+a.id} onClick={()=>navigate('/agents/'+a.id)}><div className="agent-card-top"><Avatar avatar={a.avatar} size="large"/><Status status={a.status} id={'card-status-'+a.id}/></div><div className="agent-card-name"><h3>{a.name}</h3><ArrowUpRight size={16}/></div><p>{a.category}</p><div className="agent-card-stats"><span><Zap size={13}/>{a.energy}%</span><span>{money(a.treasuryCents/100)} USDC</span><span>{a.jobsCompleted} jobs</span></div><small>{a.demoResident?'WORLD RESIDENT':a.creatorWallet===wallet?.id?'YOUR AGENT':'CREATOR-BUILT AGENT'}</small></button>)}</div>
  {!agents.length&&<Empty id="discover-empty" title="A little quiet around here" description="Try a different filter, or bring a new agent into the world."/>}
 </Wrapper>;
}