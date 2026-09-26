import { Bot, Compass } from 'lucide-react';
export const AgentModuleTabs=({selected,onSelect})=><nav className="agent-module-tabs" data-testid="agent-module-tabs" aria-label="Agent workspace">
 <button data-testid="module-my-agent" className={selected==='mine'?'selected':''} aria-pressed={selected==='mine'} onClick={()=>onSelect('mine')}><Bot size={17}/>My Agent</button>
 <button data-testid="module-other-agents" className={selected==='explore'?'selected':''} aria-pressed={selected==='explore'} onClick={()=>onSelect('explore')}><Compass size={17}/>Other Agents<span>Explore</span></button>
</nav>;