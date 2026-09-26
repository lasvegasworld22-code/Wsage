import { useCallback,useEffect,useRef,useState } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';

export const MISSION_STAGES=['MISSION RECEIVED','PLANNING','SEARCHING','COLLECTING SOURCES','ANALYZING','CROSS-CHECKING','GENERATING OUTPUT','COMPLETED'];
export function useMissionTracker(wallet,refresh,navigate,path,entered){
 const [active,setActive]=useState([]),[ready,setReady]=useState([]);const known=useRef(new Set()),seen=useRef(new Set()),owner=wallet?.id;
 const track=useCallback(m=>{known.current.add(m.id);setActive(old=>[m,...old.filter(x=>x.id!==m.id)]);if(owner)localStorage.setItem('agentws-running-'+owner,JSON.stringify([...known.current]));},[owner]);
 useEffect(()=>{setActive([]);setReady([]);if(!owner){known.current=new Set();return;}try{known.current=new Set(JSON.parse(localStorage.getItem('agentws-running-'+owner)||'[]'));seen.current=new Set(JSON.parse(localStorage.getItem('agentws-seen-'+owner)||'[]'));}catch{known.current=new Set();seen.current=new Set();}
  let stopped=false,busy=false;
  async function poll(){if(busy)return;busy=true;try{const {data}=await api.get('/missions');if(stopped)return;const running=data.filter(m=>!['COMPLETED','FAILED'].includes(m.status));running.forEach(m=>known.current.add(m.id));setActive(running);const finished=data.filter(m=>['COMPLETED','FAILED'].includes(m.status)&&known.current.has(m.id)&&!seen.current.has(m.id));if(finished.length){finished.forEach(m=>{known.current.delete(m.id);seen.current.add(m.id);});setReady(old=>[...old,...finished.filter(m=>!old.some(x=>x.id===m.id))]);localStorage.setItem('agentws-seen-'+owner,JSON.stringify([...seen.current].slice(-200)));refresh();}localStorage.setItem('agentws-running-'+owner,JSON.stringify([...known.current]));}catch{}finally{busy=false;}}
  poll();const timer=setInterval(poll,1600);return()=>{stopped=true;clearInterval(timer);};
 },[owner,refresh]);
 useEffect(()=>{if(path.startsWith('/missions/')){const viewed=path.split('/')[2];setReady(items=>items.some(m=>m.id===viewed)?items.filter(m=>m.id!==viewed):items);}},[path,ready]);
 useEffect(()=>{if(!owner||!entered||!ready.length||path!=='/')return;const next=ready[0];setReady(items=>items.slice(1));navigate('/missions/'+next.id);toast(next.status==='COMPLETED'?next.agentName+' has finished the mission.':next.agentName+' could not complete the mission.');},[ready,path,entered,navigate,owner]);
 return {active,ready,track};
}