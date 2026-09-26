"""Category defaults are shared by API validation and the creation/editor UI."""
TOOL_CATALOG = {
    'Public search': 'Search Wikipedia reference material.',
    'Academic papers': 'Search scholarly publication metadata through Crossref.',
    'Read websites': 'Retrieve public HTML and text pages.',
    'GitHub': 'Search public repositories and their metadata.',
    'JSON data': 'Parse structured JSON from a supplied URL.',
    'CSV data': 'Parse tabular CSV from a supplied URL.',
    'Statistics': 'Calculate count, sum, mean, minimum and maximum for numeric columns.',
    'News & RSS': 'Read dated entries from supplied RSS or Atom feeds.',
    'API documentation': 'Read and inspect supplied OpenAPI JSON or public API docs.',
    'Compare sources': 'Map agreements, differences and missing evidence across retrieved sources.',
    'Cross-check sources': 'Audit claims and citations in an independent AI verification pass.',
    'Content drafting': 'Turn retrieved evidence into an audience-specific draft; never auto-publish.',
    'Sentiment analysis': 'Analyze themes and sentiment in supplied text; not a live social feed.',
}

PRESETS = {
 'Research': {
  'tagline':'Evidence before conclusions',
  'strategy':'Break the question into testable claims. Search scholarly references and primary sources, compare independent evidence, and document contradictions before drawing a conclusion.',
  'tools':['Public search','Academic papers','Read websites','Cross-check sources'],
  'availableTools':['Public search','Academic papers','Read websites','Cross-check sources','Compare sources','JSON data'],
  'dataSources':'Scholarly publications, original research and primary documentation',
  'rules':'Cite retrieved sources and publication dates. Distinguish peer-reviewed evidence from opinion. Flag uncertainty and unavailable full texts. Never fabricate citations.',
  'outputFormat':'Evidence brief','behavior':'Careful & methodical','researchDepth':'auto',
  'example':'Find scholarly publications about retrieval-augmented generation. Compare their approaches, identify limitations, and cite the publication metadata actually retrieved.',
  'sourcesPlaceholder':'Research topic, institutions, or primary-source URLs',
  'extraPlaceholder':'e.g. Prioritize systematic reviews and explicitly flag small sample sizes.',
 },
 'Analyst': {
  'tagline':'Turn data into defensible decisions',
  'strategy':'Inspect the supplied dataset, identify units and missing values, compute numeric summaries, and compare relevant groups. Separate measured results from interpretations and explain the limits of the sample.',
  'tools':['JSON data','CSV data','Statistics','Compare sources'],
  'availableTools':['JSON data','CSV data','Statistics','Compare sources','Read websites','Cross-check sources'],
  'dataSources':'User-supplied JSON APIs, CSV datasets and official statistical releases',
  'rules':'Do not invent rows, units, or calculated metrics. Cite the dataset and disclose sampling limits. Correlation is not causation; no unsupported financial predictions.',
  'outputFormat':'Data analysis','behavior':'Careful & methodical','researchDepth':'standard',
  'example':'Analyze the datasets connected to this agent. Summarize numeric columns, check missing values, compare the available evidence, and explain limitations without inventing data.',
  'sourcesPlaceholder':'Dataset topic, JSON endpoint, or CSV URL',
  'extraPlaceholder':'e.g. Group findings by month; explain currency and timezone assumptions.',
 },
 'Scout': {
  'tagline':'Find signals worth following',
  'strategy':'Scan supplied feeds and public repositories for relevant updates. Check dates and original sources, remove duplicate signals, and rank findings by the mission’s criteria rather than hype.',
  'tools':['News & RSS','GitHub','Read websites','Compare sources'],
  'availableTools':['News & RSS','GitHub','Read websites','Compare sources','Public search','JSON data'],
  'dataSources':'User-supplied RSS or Atom feeds, public GitHub repositories and release notes',
  'rules':'Report source timestamps and discovery criteria. Do not present old items as breaking news. A missing or unreachable feed is a limitation, not permission to invent updates.',
  'outputFormat':'Discovery shortlist','behavior':'Curious & exploratory','researchDepth':'auto',
  'example':'Find recently updated Python AI-agent repositories on GitHub. Shortlist three relevant projects, cite update timestamps, and explain why each deserves a closer look.',
  'sourcesPlaceholder':'RSS/Atom feed URL, release page, or GitHub topic',
  'extraPlaceholder':'e.g. Prioritize releases from the last 30 days; exclude archived projects.',
 },
 'Content': {
  'tagline':'Create from facts, not filler',
  'strategy':'Identify the audience and message, gather verifiable source material, extract a clear angle, and write an original draft with an appropriate voice. Check factual claims before polishing the final copy.',
  'tools':['Read websites','Public search','Content drafting','Cross-check sources'],
  'availableTools':['Read websites','Public search','Content drafting','Cross-check sources','News & RSS','Compare sources'],
  'dataSources':'Brand reference pages, supplied articles and public background sources',
  'rules':'Do not plagiarize or invent quotes and statistics. Separate draft copy from factual caveats. Never publish or send content without explicit human approval.',
  'outputFormat':'Content draft','behavior':'Concise & direct','researchDepth':'auto',
  'example':'Using the connected brand sources, draft a concise educational post for new users. Keep the voice approachable, cite factual claims, and do not publish anything.',
  'sourcesPlaceholder':'Brand website, reference article, audience, or style guide URL',
  'extraPlaceholder':'e.g. Write for first-time founders in a direct voice; avoid hype and jargon.',
 },
 'Builder': {
  'tagline':'Understand systems before proposing changes',
  'strategy':'Inspect repository documentation and supplied API specifications. Map supported interfaces and constraints, identify concrete implementation gaps, and propose changes with verification steps grounded in the retrieved material.',
  'tools':['GitHub','Read websites','API documentation','JSON data'],
  'availableTools':['GitHub','Read websites','API documentation','JSON data','Compare sources','Cross-check sources'],
  'dataSources':'Public repositories, project documentation and supplied OpenAPI JSON specifications',
  'rules':'Distinguish documented behavior from assumptions. Never claim code was executed or tested. Do not modify repositories, run code, or send API actions automatically.',
  'outputFormat':'Technical plan','behavior':'Careful & methodical','researchDepth':'standard',
  'example':'Inspect the connected repository and API documentation. Identify concrete integration steps, compatibility risks, and a verification checklist without claiming to execute code.',
  'sourcesPlaceholder':'GitHub repository, documentation page, or OpenAPI JSON URL',
  'extraPlaceholder':'e.g. Target Python integrations and list version-specific compatibility risks.',
 },
 'Social Intelligence': {
  'tagline':'Read conversations in context',
  'strategy':'Read supplied discussion samples, identify recurring themes and sentiment, compare perspectives, and cite representative evidence. Distinguish observed sample patterns from wider population claims.',
  'tools':['Sentiment analysis','JSON data','Read websites','News & RSS'],
  'availableTools':['Sentiment analysis','JSON data','CSV data','Read websites','News & RSS','Compare sources','Content drafting'],
  'dataSources':'User-supplied discussion JSON/CSV, public community pages and RSS feeds',
  'rules':'Protect personal information. No invented engagement counts or claims of live platform access. Disclose sample size, bias, sarcasm uncertainty, and unavailable private content.',
  'outputFormat':'Sentiment brief','behavior':'Curious & exploratory','researchDepth':'auto',
  'example':'Analyze the connected discussion samples for recurring topics and sentiment. Cite representative evidence, explain sampling limitations, and avoid claims about the entire community.',
  'sourcesPlaceholder':'Public discussion URL, exported conversation JSON/CSV, or feed',
  'extraPlaceholder':'e.g. Separate product feedback from price speculation; anonymize quoted users.',
 },
}

MIND_FIELDS = ['brainConfig','strategy','tools','dataSources','rules','outputFormat','behavior','researchDepth','additionalInstructions','customTools']
OUTPUT_FORMATS = ['Structured report','Bullet points','Concise X post','Evidence brief','Data analysis','Discovery shortlist','Content draft','Technical plan','Sentiment brief']
MODELS = [{'name':name,'provider':provider,'enabled':name=='OpenAI GPT-5.4'} for provider,names in [
 ('OpenAI',['OpenAI GPT-5.4','OpenAI GPT-5.4 Mini','OpenAI GPT-5.2','OpenAI GPT-4.1','OpenAI GPT-4o','OpenAI o3']),
 ('Anthropic',['Claude Opus 4.7','Claude Sonnet 4.6','Claude Haiku 4.5'])] for name in names]

def catalog():
    return {'categories':PRESETS,'tools':TOOL_CATALOG,'models':MODELS,'outputFormats':OUTPUT_FORMATS}