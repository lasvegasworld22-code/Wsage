import { useEffect,useState,useCallback } from 'react';
import { Activity, RefreshCw, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { api,errorText } from '../lib/api';

export const ToolHealthPanel=({agentId,autoCheck=false,prefix='tool-health'})=>{
 const [health,setHealth]=useState(null),[error,setError]=useState(''),[sending,setSending]=useState(false);
 const check=useCallback(async()=>{setSending(true);setError('');try{const {data}=await api.post('/agents/'+agentId+'/tools/check');setHealth(data);}catch(e){setError(errorText(e));}finally{setSending(false);}},[agentId]);
 useEffect(()=>{
  let alive=true;setHealth(null);setError('');
  api.get('/agents/'+agentId+'/tools/health').then(({data})=>{
   if(!alive)return;setHealth(data);
   if(autoCheck&&(data.status==='UNCHECKED'||(data.checkedAt&&Date.now()-new Date(data.checkedAt).getTime()>300000)))check();
  }).catch(e=>{if(alive)setError(errorText(e));});
  return()=>{alive=false;};
 },[agentId,autoCheck,check]);
 useEffect(()=>{
  if(health?.status!=='CHECKING')return;
  let alive=true;const timer=setInterval(()=>api.get('/agents/'+agentId+'/tools/health').then(({data})=>{if(alive)setHealth(data);}).catch(e=>{if(alive){setError(errorText(e));setHealth(h=>({...h,status:'UNCHECKED'}));}}),1000);
  return()=>{alive=false;clearInterval(timer);};
 },[agentId,health?.status]);
 const working=sending||health?.status==='CHECKING',rows=health?.checks||[],failed=rows.filter(r=>r.status==='ERROR').length;
 return <section className="tool-health-panel" data-testid={prefix+'-panel'}>
  <header><h3 data-testid={prefix+'-title'}><Activity size={16}/>Connected tool status</h3><button type="button" className="text-link" disabled={working} data-testid={prefix+'-check'} onClick={check}><RefreshCw size={13} className={working?'spin':''}/>{working?'Checking…':'Check tools'}</button></header>
  <p className="tool-health-summary" role="status" data-testid={prefix+'-summary'}>{error?error:working?'Checking connections without sending actions…':!health?'Loading connection status…':health.status==='UNCHECKED'?'Not checked yet.':rows.length===0?'No external endpoints configured.':failed?`${failed} ${failed===1?'tool needs':'tools need'} attention.`:`${rows.filter(r=>r.status==='READY').length} readable · ${rows.filter(r=>r.status==='LIMITED').length} host-only checks`}</p>
  {rows.length>0&&!working&&<ul>{rows.map((row,i)=><li key={row.id} className={'health-'+row.status.toLowerCase()} data-testid={prefix+'-row-'+i}>
   {row.status==='READY'?<CheckCircle2 size={15}/>:row.status==='LIMITED'?<ShieldCheck size={15}/>:<AlertCircle size={15}/>}
   <div><div className="health-row-heading"><b data-testid={prefix+'-name-'+i}>{row.name}</b><span data-testid={prefix+'-status-'+i}>{row.status==='READY'?'Readable':row.status==='LIMITED'?'Host only':'Needs attention'}</span></div><p data-testid={prefix+'-message-'+i}>{row.message}</p><small data-testid={prefix+'-url-'+i}>{row.method} · {row.url}</small></div>
  </li>)}</ul>}
  {health?.checkedAt&&<small className="health-timestamp" data-testid={prefix+'-checked-at'}>Checked {new Date(health.checkedAt).toLocaleTimeString()} · Connection snapshot</small>}
  {failed>0&&!working&&autoCheck&&<p className="health-caution" data-testid={prefix+'-warning'}>Some sources need attention. You can still run with other available sources.</p>}
 </section>;
};