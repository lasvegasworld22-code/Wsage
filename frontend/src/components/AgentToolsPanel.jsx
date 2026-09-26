import { useEffect,useState } from 'react';
import { Link2, ShieldCheck, Send, X, Settings2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { api,errorText } from '../lib/api';
import { Action } from './Primitives';
import { ToolHealthPanel } from './ToolHealthPanel';

export const AgentToolsPanel=({agent,navigate})=>{
 const [tools,setTools]=useState([]),[actions,setActions]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [selected,setSelected]=useState(null),[body,setBody]=useState('{}'),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true;
  api.get('/agents/'+agent.id+'/settings').then(r=>{if(alive){setTools(r.data.customTools||[]);setLoading(false);}}).catch(e=>{if(alive){setError(errorText(e));setLoading(false);}});
  const load=()=>api.get('/agents/'+agent.id+'/tool-actions').then(r=>{if(alive)setActions(r.data);}).catch(e=>{if(alive)setError(errorText(e));});
  load();const timer=setInterval(load,3000);return()=>{alive=false;clearInterval(timer);};
 },[agent.id]);
 async function preview(){setBusy(true);try{
  let payload;try{payload=JSON.parse(body);}catch{throw new Error('Enter a valid JSON payload.');}
  if(!payload||Array.isArray(payload)||typeof payload!=='object')throw new Error('The payload must be a JSON object.');
  const {data}=await api.post('/agents/'+agent.id+'/tool-actions',{toolId:selected.id,body:payload});setDraft(data);setActions(items=>[data,...items]);
 }catch(e){toast.error(e.response?errorText(e):e.message);}finally{setBusy(false);}}
 async function decide(approve){setBusy(true);try{
  const {data}=await api.post('/tool-actions/'+draft.id+(approve?'/approve':'/reject'),approve?{confirmed:true}:{});
  setActions(items=>items.map(a=>a.id===data.id?data:a));setDraft(null);setSelected(null);
  toast.success(approve?'Approved. Sending this request once.':'Request rejected. Nothing was sent.');
 }catch(e){toast.error(errorText(e));}finally{setBusy(false);}}
 return <section className="agent-tools-panel" data-testid="agent-tools-panel">
  <div className="mind-section-heading"><h3 data-testid="private-tools-title"><ShieldCheck size={16}/>Private tools & permissions</h3><button className="text-link" data-testid="tools-edit" onClick={()=>navigate('/agents/'+agent.id+'/mind')}><Settings2 size={15}/>Edit</button></div>
  <ToolHealthPanel agentId={agent.id}/>
  {loading?<p data-testid="tools-loading">Loading your tools…</p>:error?<p className="notice error" data-testid="tools-error">{error}</p>:!tools.length?<p className="notice" data-testid="tools-empty">No custom endpoints connected. Add a URL, JSON dataset, feed, or action API in Mind & methods.</p>:<div className="connected-tools">{tools.map((tool,i)=><div className="connected-tool" key={tool.id} data-testid={'connected-tool-'+i}><Link2 size={17}/><div><b data-testid={'connected-tool-name-'+i}>{tool.name}</b><span data-testid={'connected-tool-url-'+i}>{tool.url}</span><small data-testid={'connected-tool-permission-'+i}>{tool.method==='GET'?'READ DURING MISSIONS':'APPROVAL REQUIRED'} · {tool.format.toUpperCase()}{tool.headerNames?.length?' · Private headers saved':''}</small></div>{tool.method==='POST'&&<button className="text-link" data-testid={'review-tool-'+i} disabled={busy||!!draft} onClick={()=>{setSelected(tool);setBody(JSON.stringify(tool.body||{},null,2));setDraft(null);}}>Review<ArrowRight size={15}/></button>}</div>)}</div>}
  {selected&&!draft&&<div className="action-request-editor" data-testid="action-request-editor"><h3 data-testid="action-editor-title">Prepare {selected.name}</h3><label htmlFor="action-body">Request payload (JSON)</label><textarea id="action-body" data-testid="action-body" value={body} rows={6} maxLength={16000} onChange={e=>setBody(e.target.value)}/><div className="form-actions"><Action secondary data-testid="action-cancel-edit" onClick={()=>setSelected(null)}>Cancel</Action><Action data-testid="action-preview" busy={busy} onClick={preview}>Review exact request<ArrowRight size={15}/></Action></div></div>}
  {draft&&<div className="action-approval" data-testid="action-approval"><h3 data-testid="action-approval-title"><ShieldCheck size={17}/>Approve this exact request?</h3><p data-testid="action-destination"><b>{draft.method}</b> {draft.url}</p><small data-testid="action-header-names">Headers: {draft.headerNames.length?draft.headerNames.join(', '):'No secret headers'}</small><pre data-testid="action-payload">{JSON.stringify(draft.body,null,2)}</pre><p className="notice" data-testid="action-warning">Approving sends this payload to the endpoint and may change data there. Nothing has been sent yet. Requests are never retried automatically.</p><div className="form-actions"><Action secondary data-testid="action-reject" busy={busy} onClick={()=>decide(false)}><X size={14}/>Reject</Action><Action data-testid="action-approve" busy={busy} onClick={()=>decide(true)}><Send size={14}/>Approve & send once</Action></div></div>}
  {actions.length>0&&<div className="tool-action-history"><h3 data-testid="tool-action-history-title">Request history</h3>{actions.map((a,i)=><article data-testid={'tool-action-'+i} key={a.id}><header><b>{a.toolName}</b><span data-testid={'tool-action-status-'+i}>{a.status.replaceAll('_',' ')}</span></header><p data-testid={'tool-action-date-'+i}>{new Date(a.createdAt).toLocaleString()}</p>{a.status==='PENDING'&&!draft&&<button className="text-link" data-testid={'resume-action-'+i} onClick={()=>{setSelected(null);setDraft(a);}}>Review pending request<ArrowRight size={13}/></button>}{a.error&&<p className="notice error" data-testid={'tool-action-error-'+i}>{a.error}</p>}{a.result&&<details data-testid={'tool-result-'+i}><summary data-testid={'tool-result-toggle-'+i}>HTTP {a.httpStatus} · Response</summary><pre data-testid={'tool-result-body-'+i}>{a.result}</pre></details>}</article>)}</div>}
 </section>;
};