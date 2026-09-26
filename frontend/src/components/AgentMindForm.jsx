import { ModelPicker } from './ModelPicker';
import { CustomToolsEditor } from './CustomToolsEditor';

export function presetMind(catalog,category){
 const {strategy,tools,dataSources,rules,outputFormat,behavior,researchDepth}=catalog.categories[category];
 return {strategy,tools:[...tools],dataSources,rules,outputFormat,behavior,researchDepth,brainConfig:'OpenAI GPT-5.4',additionalInstructions:'',customTools:[]};
}

export const AgentMindForm=({form,set,catalog})=>{
 const preset=catalog.categories[form.category];
 const available=[...new Set([...preset.availableTools,...form.tools])];
 return <div className="system-form category-mind" data-testid="category-mind">
  <div className="mind-category-heading"><span data-testid="mind-category">{form.category.toUpperCase()} MIND</span><p data-testid="mind-category-tagline">{preset.tagline}</p></div>
  <div className="field-grid"><ModelPicker models={catalog.models} value={form.brainConfig}/><div><label htmlFor="behavior">Behavior</label><select id="behavior" data-testid="agent-behavior" value={form.behavior} onChange={e=>set('behavior',e.target.value)}>{['Careful & methodical','Curious & exploratory','Concise & direct'].map(v=><option key={v}>{v}</option>)}</select></div></div>
  <label htmlFor="strategy">Strategy & methodology</label><textarea id="strategy" data-testid="agent-strategy" rows={4} value={form.strategy} maxLength={3000} placeholder={preset.strategy} onChange={e=>set('strategy',e.target.value)}/>
  <label>Enabled tools</label><div className="specialist-tools">{available.map((tool,i)=><label key={tool} className={form.tools.includes(tool)?'enabled':''}><input type="checkbox" data-testid={'agent-tool-'+i} aria-label={tool} checked={form.tools.includes(tool)} onChange={e=>set('tools',e.target.checked?[...form.tools,tool]:form.tools.filter(t=>t!==tool))}/><span><b data-testid={'agent-tool-label-'+i}>{tool}</b><small data-testid={'agent-tool-description-'+i}>{catalog.tools[tool]}</small></span></label>)}</div>
  <div className="field-grid"><div><label htmlFor="sources">Preferred data sources</label><textarea id="sources" data-testid="agent-sources" rows={2} value={form.dataSources} maxLength={2000} placeholder={preset.sourcesPlaceholder} onChange={e=>set('dataSources',e.target.value)}/></div><div><label htmlFor="format">Output format</label><select id="format" data-testid="agent-output-format" value={form.outputFormat} onChange={e=>set('outputFormat',e.target.value)}>{catalog.outputFormats.map(v=><option key={v}>{v}</option>)}</select></div></div>
  <label htmlFor="rules">Rules & boundaries</label><textarea id="rules" data-testid="agent-rules" rows={3} value={form.rules} maxLength={3000} placeholder={preset.rules} onChange={e=>set('rules',e.target.value)}/>
  <div className="research-depth-field"><label htmlFor="research-depth">Research depth</label><select id="research-depth" data-testid="agent-research-depth" value={form.researchDepth||'auto'} onChange={e=>set('researchDepth',e.target.value)}><option value="auto">Automatic · adapt to the objective</option><option value="quick">Quick · 1–2 minutes</option><option value="standard">Standard · 2–3½ minutes</option><option value="deep">Deep search · 3½–5 minutes</option></select></div>
  <label htmlFor="additional-instructions">Specialist instructions <small>Optional</small></label><textarea id="additional-instructions" data-testid="agent-additional-instructions" rows={2} value={form.additionalInstructions||''} maxLength={2000} placeholder={preset.extraPlaceholder} onChange={e=>set('additionalInstructions',e.target.value)}/>
  <CustomToolsEditor tools={form.customTools||[]} preset={preset} onChange={tools=>set('customTools',tools)}/>
 </div>;
};