import { Plus, Trash2, Link2, ShieldCheck } from 'lucide-react';

export function toolsForRequest(tools){
 return tools.map(({headersText,bodyText,headerNames,...tool})=>{
  let headers,body;
  try{headers=headersText?.trim()?JSON.parse(headersText):tool.id?undefined:{};body=bodyText?.trim()?JSON.parse(bodyText):tool.body||{};}catch{throw new Error('Custom tool headers and payload must be valid JSON objects.');}
  for(const value of [headers,body])if(value!==undefined&&(!value||Array.isArray(value)||typeof value!=='object'))throw new Error('Headers and payload must be JSON objects.');
  if(headers&&Object.values(headers).some(v=>typeof v!=='string'))throw new Error('Header values must be text.');
  if(tool.name.trim().length<2)throw new Error('Give every custom tool a name of at least two characters.');
  let url;try{url=new URL(tool.url);}catch{throw new Error('Give every custom tool a valid HTTP(S) URL.');}
  if(!['https:','http:'].includes(url.protocol))throw new Error('Tool URLs must use HTTP or HTTPS.');
  return {...tool,headers,body};
 });
}

export const CustomToolsEditor=({tools,onChange,preset})=>{
 const set=(i,key,value)=>onChange(tools.map((t,index)=>index===i?{...t,[key]:value}:t));
 return <section className="custom-tools-editor">
  <div className="mind-section-heading"><h3 data-testid="custom-tools-heading"><Link2 size={16}/>Custom sources & APIs <small>Optional</small></h3><button type="button" className="text-link" data-testid="add-custom-tool" disabled={tools.length>=8} onClick={()=>onChange([...tools,{name:'',url:'',method:'GET',format:'website',headersText:'',bodyText:'{}'}])}><Plus size={15}/>Add tool</button></div>
  {tools.map((tool,i)=><div className="custom-tool-item" key={tool.id||i} data-testid={'custom-tool-'+i}>
   <div className="custom-tool-header"><span data-testid={'custom-tool-number-'+i}>TOOL {String(i+1).padStart(2,'0')}</span><button type="button" data-testid={'remove-custom-tool-'+i} aria-label="Remove tool" title="Remove tool" onClick={()=>onChange(tools.filter((_,n)=>n!==i))}><Trash2 size={15}/></button></div>
   <div className="field-grid"><div><label htmlFor={'tool-name-'+i}>Name</label><input id={'tool-name-'+i} data-testid={'tool-name-'+i} value={tool.name} maxLength={60} placeholder="e.g. Project data" onChange={e=>set(i,'name',e.target.value)}/></div><div><label htmlFor={'tool-method-'+i}>Permission</label><select id={'tool-method-'+i} data-testid={'tool-method-'+i} value={tool.method} onChange={e=>set(i,'method',e.target.value)}><option value="GET">GET · Read during missions</option><option value="POST">POST · Ask before each action</option></select></div></div>
   <label htmlFor={'tool-url-'+i}>Endpoint URL</label><input id={'tool-url-'+i} data-testid={'tool-url-'+i} type="url" value={tool.url} maxLength={2048} placeholder="https://your-source.example/data.json" onChange={e=>set(i,'url',e.target.value)}/>
   <label htmlFor={'tool-format-'+i}>Response format</label><select id={'tool-format-'+i} data-testid={'tool-format-'+i} value={tool.format} onChange={e=>set(i,'format',e.target.value)}><option value="website">Web page / text</option><option value="json">JSON / API data</option><option value="csv">CSV dataset</option><option value="rss">RSS / Atom feed</option></select>
   <details data-testid={'tool-credentials-'+i}><summary data-testid={'tool-credentials-toggle-'+i}>Secret headers <span>{tool.headerNames?.length?'Saved · values hidden':'Optional'}</span></summary><label htmlFor={'tool-headers-'+i}>Headers (JSON)</label><textarea id={'tool-headers-'+i} data-testid={'tool-headers-'+i} rows={2} value={tool.headersText||''} placeholder={'{"Authorization":"Bearer YOUR_KEY"}'} autoComplete="off" spellCheck={false} onChange={e=>set(i,'headersText',e.target.value)}/><small data-testid={'tool-headers-note-'+i}>{tool.headerNames?.length?'Leave blank to keep saved headers. Enter {} to clear them.':'Stored privately on the server; not saved in your browser draft. HTTPS required.'}</small></details>
   {tool.method==='POST'&&<><label htmlFor={'tool-body-'+i}>Default payload (JSON)</label><textarea id={'tool-body-'+i} data-testid={'tool-body-'+i} rows={3} value={tool.bodyText??JSON.stringify(tool.body||{},null,2)} onChange={e=>set(i,'bodyText',e.target.value)}/><p className="tool-permission-note" data-testid={'tool-permission-'+i}><ShieldCheck size={14}/>Each request needs your approval of its exact URL and payload.</p></>}
  </div>)}
 </section>;
};