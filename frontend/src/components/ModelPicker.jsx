import { useState } from 'react';
import { Cpu, Check, LockKeyhole, ChevronDown } from 'lucide-react';

export const ModelPicker=({models,value})=>{
 const [open,setOpen]=useState(false);
 return <div className="model-picker">
  <label id="brain-label">AI model</label>
  <button type="button" className="model-current" data-testid="agent-brain" aria-labelledby="brain-label" aria-expanded={open} onClick={()=>setOpen(!open)}><Cpu size={17}/><span>{value}</span><ChevronDown size={15}/></button>
  {open&&<div className="model-options" data-testid="model-options">{models.map((model,i)=><button type="button" data-testid={'model-option-'+i} key={model.name} disabled={!model.enabled} className={model.enabled?'enabled':'locked'} onClick={()=>setOpen(false)}><span><b>{model.name}</b><small>{model.provider}</small></span>{model.enabled?<Check size={16}/>:<span className="model-lock"><LockKeyhole size={13}/>Locked</span>}</button>)}</div>}
 </div>;
};