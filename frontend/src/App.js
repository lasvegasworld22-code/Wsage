import { useCallback,useEffect,useRef,useState } from 'react';
import { BrowserRouter,useNavigate,useLocation } from 'react-router-dom';
import { Toaster,toast } from 'sonner';
import { World } from './components/World';
import { Hud } from './components/Hud';
import { Welcome,GuidedTour } from './components/Welcome';
import { MissionTracker } from './components/MissionTracker';
import { useMissionTracker } from './hooks/useMissionTracker';
import { api } from './lib/api';
import CreateAgent from './pages/CreateAgent';
import Discover from './pages/Discover';
import AgentModule from './pages/AgentModule';
import EditAgentMind from './pages/EditAgentMind';
import ProjectNews from './pages/ProjectNews';
import Profile from './pages/Profile';
import Docs from './pages/Docs';
import { NewMission,MissionReport,WorkFeed } from './pages/Missions';
import { WalletPanel,TreasuryPanel,ExchangePanel,SkillsPanel,ChatPanel } from './pages/WorldSystems';
import './App.css';
import './layout-refinements.css';
import './world/label-safety.css';
import './civilization-v2.css';
import './tracker-readability.css';
import './identity-refinements.css';
import './plaza-updates.css';

function Civilization(){
 const navigate=useNavigate(),location=useLocation(),engineRef=useRef(),entryTimer=useRef();
 const [world,setWorld]=useState({agents:[],pool:{},liveAI:false}),[wallet,setWallet]=useState(null),[connectionError,setConnectionError]=useState(false);
 const [catalog,setCatalog]=useState(null);
 useEffect(()=>{api.get('/catalog').then(r=>setCatalog(r.data)).catch(()=>toast.error('Agent tools could not load. Please refresh to retry.'));},[]);
 const [entered,setEntered]=useState(()=>sessionStorage.getItem('agentws-entered')==='yes'||!['/','/docs'].includes(location.pathname)),[leaving,setLeaving]=useState(false),[tour,setTour]=useState(false);
 const refresh=useCallback(async()=>{try{const {data}=await api.get('/world');setWorld(data);setConnectionError(false);if(localStorage.getItem('agentws-session')){try{const r=await api.get('/session');setWallet(r.data);}catch(e){if(e.response?.status===401){localStorage.removeItem('agentws-session');setWallet(null);}}}}catch{setConnectionError(true);}},[]);
 useEffect(()=>{refresh();const interval=setInterval(refresh,5000);return()=>{clearInterval(interval);clearTimeout(entryTimer.current);};},[refresh]);
 const tracker=useMissionTracker(wallet,refresh,navigate,location.pathname,entered);
 const trackMission=tracker.track;
 const enterWorld=useCallback(()=>{navigate('/');if(entered)return;setLeaving(true);engineRef.current?.setEntered(true);clearTimeout(entryTimer.current);entryTimer.current=setTimeout(()=>{setEntered(true);setLeaving(false);sessionStorage.setItem('agentws-entered','yes');},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1200);},[entered,navigate]);
 function showAbout(){navigate('/');setTour(false);setEntered(false);setLeaving(false);sessionStorage.removeItem('agentws-entered');}
 function startTour(){setTour(true);enterWorld();}
 async function connect(){let token=localStorage.getItem('agentws-demo-identity');if(token){localStorage.setItem('agentws-session',token);try{const {data}=await api.get('/session');setWallet(data);await refresh();return;}catch{localStorage.removeItem('agentws-demo-identity');localStorage.removeItem('agentws-session');}}const {data}=await api.post('/session');localStorage.setItem('agentws-session',data.token);localStorage.setItem('agentws-demo-identity',data.token);setWallet(data.wallet);await refresh();}
 function disconnect(){localStorage.removeItem('agentws-session');setWallet(null);toast.success('Disconnected. Your identity is saved on this browser.');}
 const missionStarted=useCallback(m=>{trackMission(m);setEntered(true);setLeaving(false);sessionStorage.setItem('agentws-entered','yes');navigate('/');refresh();},[trackMission,navigate,refresh]);
 const path=location.pathname,parts=path.split('/').filter(Boolean),props={world,wallet,navigate,refresh,catalog,onMissionStarted:missionStarted};
 return <main className={'civilization-app '+(entered?'experience-world':'experience-intro')+(tracker.active.length?' has-active-mission':'')}>
  <World agents={world.agents} wallet={wallet} engineRef={engineRef} entered={entered} onInteract={e=>entered&&navigate(e.type==='agent'?'/agents/'+e.id:'/'+e.id)}/>
  {!entered&&<Welcome onEnter={enterWorld} onDocs={()=>navigate('/docs')} population={world.population} leaving={leaving}/>}
  {entered&&<><Hud {...props} route={path} engineRef={engineRef} onAbout={showAbout} onTour={startTour}/><MissionTracker missions={tracker.active} ready={tracker.ready} navigate={navigate}/>{tour&&<GuidedTour onClose={()=>setTour(false)} navigate={navigate}/>}</>}
  {connectionError&&<button className="connection-error" data-testid="connection-error" onClick={refresh}>Connection interrupted. Click to reconnect.</button>}
  {path==='/docs'&&<Docs navigate={navigate} entered={entered} onTour={startTour} onEnter={enterWorld}/>}
  {path==='/create'&&<CreateAgent {...props}/>}
  {path==='/agents'&&<AgentModule {...props}/>}
  {parts[0]==='agents'&&parts[1]&&!parts[2]&&<Profile {...props} id={parts[1]}/>}
  {parts[0]==='agents'&&parts[2]==='mission'&&<NewMission {...props} id={parts[1]}/>}
  {parts[0]==='agents'&&parts[2]==='mind'&&<EditAgentMind {...props} id={parts[1]}/>}
  {parts[0]==='missions'&&parts[1]&&<MissionReport {...props} id={parts[1]}/>}
  {path==='/work-feed'&&<WorkFeed {...props}/>}
  {path==='/wallet'&&<WalletPanel {...props} connect={connect} disconnect={disconnect}/>}
  {path==='/treasury'&&<TreasuryPanel {...props}/>}
  {path==='/exchange'&&<ExchangePanel {...props}/>}
  {path==='/news'&&<ProjectNews navigate={navigate}/>}
  {path==='/skills'&&<SkillsPanel {...props}/>}
  {path==='/chat'&&<ChatPanel {...props}/>}<Toaster theme="dark" position="top-center" richColors/>
 </main>;
}
export default function App(){return <BrowserRouter><Civilization/></BrowserRouter>;}