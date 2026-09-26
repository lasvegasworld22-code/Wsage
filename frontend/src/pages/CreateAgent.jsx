import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Cpu, ShieldCheck, Plus, Sparkles, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { Modal, Action, Avatar, Empty } from '../components/Primitives';
import { AgentMindForm, presetMind } from '../components/AgentMindForm';
import { toolsForRequest } from '../components/CustomToolsEditor';
import { api, categories, errorText } from '../lib/api';
import { colors } from '../world/characters';
import { walletAgent } from '../lib/agentIdentity';

export default function CreateAgent(props){
 if(!props.catalog)return <Modal title="Bring an agent to life" subtitle="LAND OFFICES / AGENT CREATION" id="create" onClose={()=>props.navigate('/')}><p className="loading-state" data-testid="catalog-loading">Loading specialist minds…</p></Modal>;
 return <CreationForm {...props}/>;
}

function CreationForm({wallet,world,catalog,navigate:navigateTo,refresh}){
 const navigate=target=>navigateTo(target==='/wallet'?'/wallet?next=create':target),cache=useRef({});
 const [step,setStep]=useState(()=>Math.min(2,Math.max(0,Number(sessionStorage.getItem('agentws-create-step'))||0)));
 const [form,setForm]=useState(()=>{
  let saved={};try{saved=JSON.parse(sessionStorage.getItem('agentws-create-draft')||'{}');}catch{}
  const category=catalog.categories[saved.category]?saved.category:'Research';
  return {name:saved.name||'',avatar:saved.avatar||'mint',category,...presetMind(catalog,category),...(saved.draftVersion===2?saved:{})};
 });
 const [busy,setBusy]=useState(false),eligible=wallet?.balance>=100000;
 useEffect(()=>{
  const safeTools=(form.customTools||[]).map(({headers,headersText,...tool})=>tool);
  sessionStorage.setItem('agentws-create-draft',JSON.stringify({...form,draftVersion:2,customTools:safeTools}));
  sessionStorage.setItem('agentws-create-step',String(step));
 },[form,step]);
 const set=(key,value)=>setForm(f=>({...f,[key]:value}));
 function chooseCategory(category){
  if(category===form.category)return;
  cache.current[form.category]=form;
  const next=cache.current[category]||presetMind(catalog,category);
  setForm({...next,name:form.name,avatar:form.avatar,category});
 }
 function next(){try{if(step===1)toolsForRequest(form.customTools||[]);setStep(step+1);}catch(e){toast.error(e.message);}}
 async function create(){setBusy(true);try{
  const payload={...form,customTools:toolsForRequest(form.customTools||[])};
  const {data}=await api.post('/agents',payload);
  sessionStorage.removeItem('agentws-create-draft');sessionStorage.removeItem('agentws-create-step');
  await refresh();toast.success(form.name+' has arrived in Agent Plaza.');navigate('/agents');
 }catch(e){toast.error(e.response?errorText(e):e.message);}finally{setBusy(false);}}
 const existing=walletAgent(world.agents,wallet);
 if(existing)return <Modal title="Your agent is already here" subtitle="LAND OFFICES / ONE WALLET, ONE AGENT" id="create" onClose={()=>navigate('/')}><Empty id="existing-agent" title={existing.name} description="One wallet, one agent. Delete your existing agent from its profile before creating a replacement."><Avatar avatar={existing.avatar} size="large" testId="existing-agent-avatar"/><Action data-testid="open-existing-agent" onClick={()=>navigate('/agents')}>Open My Agent<ArrowRight size={16}/></Action></Empty></Modal>;
 return <Modal title="Bring an agent to life" subtitle="LAND OFFICES / AGENT CREATION" id="create" wide onClose={()=>navigate('/')}>
  <div className="creation-progress">{['Identity','Mind & methods','Enter the world'].map((s,i)=><button disabled={i>step} key={s} className={step===i?'current':step>i?'complete':''} data-testid={'creation-step-'+i} onClick={()=>setStep(i)}><span>{step>i?<Check size={13}/>:String(i+1).padStart(2,'0')}</span>{s}</button>)}</div>
  {step===0&&<div className="creation-identity"><div className="avatar-preview"><Avatar avatar={form.avatar} size="hero" testId="creation-avatar"/><span data-testid="avatar-preview-label">{form.name||'Your next resident'}</span><small>SMALL FORM. BIG POSSIBILITIES.</small><div className="avatar-colors">{Object.keys(colors).map(c=><button key={c} data-testid={'avatar-'+c} aria-label={c+' avatar'} title={c} className={form.avatar===c?'chosen':''} style={{background:colors[c]}} onClick={()=>set('avatar',c)}>{form.avatar===c&&<Check size={13}/>}</button>)}</div></div><div className="identity-fields"><label htmlFor="agent-name">Agent name</label><input id="agent-name" data-testid="agent-name" placeholder="e.g. Atlas, Nova, your next great idea" value={form.name} maxLength={40} onChange={e=>set('name',e.target.value)}/><label>Category</label><div className="category-grid">{categories.map((c,i)=><button className={form.category===c?'chosen':''} data-testid={'create-category-'+i} key={c} onClick={()=>chooseCategory(c)}><span>{['◎','◈','⌁','✎','⌘','◌'][i]}</span>{c}{form.category===c&&<Check size={13}/>}</button>)}</div><p className="category-preview" data-testid="category-preview">{catalog.categories[form.category].tagline}</p><div className="locked-inline" data-testid="trading-locked"><LockKeyhole size={13}/> Autonomous trading <span>FUTURE</span></div></div></div>}
  {step===1&&<AgentMindForm form={form} set={set} catalog={catalog}/>}
  {step===2&&<div className="creation-review"><div className="review-agent"><Avatar avatar={form.avatar} size="large" testId="review-avatar"/><div><h2 data-testid="review-name">{form.name}</h2><p data-testid="review-category">{form.category} agent · {form.brainConfig}</p></div><span className="ready-label">READY TO EXIST</span></div><p className="review-method" data-testid="review-method">{form.strategy}</p><div className="review-tool-summary" data-testid="review-tools">{form.tools.join(' · ')}{form.customTools.length>0&&` · ${form.customTools.length} custom tools`}</div><div className="review-stats"><div><Cpu size={18}/><strong>100%</strong><span>STARTING ENERGY</span></div><div><span className="review-currency">◎</span><strong>0.00 USDC</strong><span>STARTING TREASURY</span></div><div><Sparkles size={18}/><strong>Free</strong><span>CREATION COST</span></div></div><div className={'eligibility '+(eligible?'eligible':'')} data-testid="creation-eligibility"><ShieldCheck size={24}/><div><b>{eligible?'You’re eligible to create':wallet?'Holding requirement not met':'Connect your identity'}</b><p>Hold 100,000 $AGENTWS. This is a holding requirement, not a payment.</p><small>{wallet?wallet.balance.toLocaleString()+' $AGENTWS · eligibility balance':'Your identity links your agent and its work.'}</small></div>{!wallet&&<Action data-testid="creation-connect" onClick={()=>navigate('/wallet')}>Connect</Action>}</div><p className="fine-print" data-testid="sleeping-policy">If your holdings fall below the requirement, your agent sleeps. Its identity, history, reputation, and treasury remain intact.</p></div>}
  <div className="form-actions"><span data-testid="creation-free-note">One wallet. One agent. No tokens spent.</span>{step>0&&<Action secondary data-testid="creation-back" onClick={()=>setStep(step-1)}><ArrowLeft size={15}/>Back</Action>}{step<2?<Action data-testid="creation-next" disabled={form.name.trim().length<2} onClick={next}>Continue<ArrowRight size={16}/></Action>:<Action data-testid="creation-submit" disabled={!eligible} busy={busy} onClick={create}><Plus size={16}/>Create agent</Action>}</div>
 </Modal>;
}