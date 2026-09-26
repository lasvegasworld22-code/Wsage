import { useEffect,useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api,errorText } from '../lib/api';
import { Modal,Action,Empty } from '../components/Primitives';
import { AgentMindForm,presetMind } from '../components/AgentMindForm';
import { toolsForRequest } from '../components/CustomToolsEditor';

export default function EditAgentMind({id,catalog,navigate,refresh}){
 const [form,setForm]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reset,setReset]=useState(false);
 useEffect(()=>{let active=true;api.get('/agents/'+id+'/settings').then(r=>{if(active)setForm(r.data);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[id]);
 async function save(){setBusy(true);try{await api.patch('/agents/'+id+'/mind',{...form,customTools:toolsForRequest(form.customTools||[])});await refresh();toast.success('Mind and tools updated.');navigate('/agents');}catch(e){toast.error(e.response?errorText(e):e.message);}finally{setBusy(false);}}
 return <Modal title="Mind & methods" subtitle="MY AGENT / SPECIALIST CONFIGURATION" id="edit-mind" wide onClose={()=>navigate('/agents')}>
  {error?<Empty title="Unable to open this mind" description={error}/>:!form||!catalog?<p data-testid="mind-loading">Loading agent configuration…</p>:<>
   <div className="mind-editor-heading"><span data-testid="mind-editor-agent">{form.name} · {form.category}</span><button className="text-link" data-testid="mind-reset-defaults" onClick={()=>setReset(!reset)}><RotateCcw size={14}/>Category defaults</button></div>
   {reset&&<div className="notice" data-testid="mind-reset-notice"><p>Replace methods and built-in tools with {form.category} defaults? Custom endpoints are kept.</p><Action secondary data-testid="mind-reset-cancel" onClick={()=>setReset(false)}>Keep changes</Action><Action data-testid="mind-reset-confirm" onClick={()=>{setForm({...form,...presetMind(catalog,form.category),customTools:form.customTools||[]});setReset(false);}}>Apply defaults</Action></div>}
   <AgentMindForm form={form} set={(key,value)=>setForm(f=>({...f,[key]:value}))} catalog={catalog}/>
   <div className="form-actions"><Action secondary data-testid="mind-cancel" onClick={()=>navigate('/agents')}>Cancel</Action><Action data-testid="mind-save" busy={busy} disabled={form.status==='WORKING'} onClick={save}><Save size={15}/>Save mind</Action></div>
   {form.status==='WORKING'&&<p className="notice" data-testid="mind-working">Wait for the current mission before changing its methods.</p>}
  </>}
 </Modal>;
}