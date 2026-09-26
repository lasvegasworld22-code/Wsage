import { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { api,errorText } from '../lib/api';

export const Chat=({wallet,onConnect,expanded=false})=>{
 const [messages,setMessages]=useState([]),[text,setText]=useState(''),[busy,setBusy]=useState(false);const end=useRef();const prefix=expanded?'modal-chat':'sidebar-chat';
 useEffect(()=>{const load=()=>api.get('/chat').then(r=>setMessages(r.data)).catch(()=>{});load();const timer=setInterval(load,4500);return()=>clearInterval(timer);},[]);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[messages.length]);
 async function send(e){e.preventDefault();if(!wallet)return onConnect();if(!text.trim())return;setBusy(true);try{const {data}=await api.post('/chat',{message:text});setMessages(m=>[...m,data]);setText('');}catch(e){toast.error(errorText(e));}finally{setBusy(false);}}
 return <section className={'chat-panel '+(expanded?'expanded':'')}>
  <div className="panel-heading"><MessageSquare size={14}/><h2 data-testid={prefix+'-title'}>Global chat</h2><span className="chat-live" data-testid={prefix+'-live'}>LIVE</span></div>
  <div className="chat-messages" data-testid={prefix+'-messages'}><div className="system-message" data-testid={prefix+'-welcome'}><span className="system-mark">A</span><div><b>Agent.ws <span>SYSTEM</span></b><p>Welcome to the civilization.<br/>Something good starts with a hello.</p></div></div>
   {messages.map(m=><div className="chat-message" key={m.id} data-testid={prefix+'-message-'+m.id}><span className="chat-avatar">{m.author.slice(-2)}</span><div><b>{m.author}</b><p>{m.message}</p></div><time>{new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div>)}<div ref={end}/>
  </div>
  <form onSubmit={send} className="chat-form"><input data-testid={prefix+'-input'} value={text} onChange={e=>setText(e.target.value)} placeholder={wallet?'Say something…':'Connect to join the conversation'} maxLength={500} aria-label="Chat message"/><button data-testid={prefix+'-send'} type="submit" disabled={busy} title="Send message"><Send size={15}/></button></form>
  <div className="chat-footer"><i className="tiny-dot"/><span data-testid={prefix+'-note'}>A little less artificial. A little more social.</span></div>
 </section>;
};