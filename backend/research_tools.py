"""Real data adapters; analysis/drafting tools augment the existing streamed AI passes."""
import csv, io, json, math, os, re, statistics
from html import unescape
from urllib.parse import urlencode, urlsplit
from defusedxml import ElementTree
from safe_http import public_request
from tool_config import read_headers, redact

READ_TOOLS={'Read websites','JSON data','CSV data','News & RSS','API documentation'}
ANALYSIS_TOOLS={
 'Compare sources':'Create a side-by-side evidence comparison. Identify agreement, disagreement, dates, and missing information.',
 'Sentiment analysis':'Classify sentiment and themes only in the retrieved sample, quote representative evidence, and explain sarcasm, sampling bias and uncertainty. Never invent population percentages.',
 'Content drafting':'Produce an original audience-appropriate draft based on verified evidence. Keep supporting source notes separate from the finished draft. Never publish.',
 'API documentation':'Inspect documented endpoints, required parameters, authentication descriptions and schemas. Distinguish supported operations from assumptions. Do not execute code or actions.',
 'Statistics':'Use the supplied server-computed column statistics exactly. State row counts and sampling limits. Do not invent calculations or treat correlation as causation.',
 'Cross-check sources':'Independently verify the material claims against the actually retrieved evidence, checking citation relevance and contradictions.',
}

async def academic_search(query):
    url=os.environ['CROSSREF_API_URL']+'/works?'+urlencode({'query':query[:250],'rows':5})
    text,_,_,_=await public_request(url)
    items=json.loads(text).get('message',{}).get('items',[])
    return [{'title':(item.get('title') or ['Untitled publication'])[0],'url':item.get('URL',url),'excerpt':json.dumps({k:item.get(k) for k in ['title','author','published','type','abstract','DOI']})[:10000],'provider':'Crossref','retrievalType':'publication metadata'} for item in items]

def rows_from_json(data):
    if isinstance(data,list): return data
    if isinstance(data,dict):
        for key in ['data','results','items','records']:
            if isinstance(data.get(key),list): return data[key]
        return [data]
    return []

def column_stats(rows):
    rows=[r for r in rows[:500] if isinstance(r,dict)]
    keys=list(dict.fromkeys(k for row in rows for k in row))[:30]
    result={}
    for key in keys:
        values=[]
        for row in rows:
            raw=row.get(key)
            if isinstance(raw,bool) or raw in (None,''): continue
            try:
                value=float(raw)
                if math.isfinite(value) and abs(value)<1e100: values.append(value)
            except (TypeError,ValueError): pass
        if values: result[str(key)]={'count':len(values),'missingOrNonNumeric':len(rows)-len(values),'sum':math.fsum(values),'mean':statistics.fmean(values),'minimum':min(values),'maximum':max(values)}
    return {'sampleRows':len(rows),'maximumRows':500,'columns':result}

def parse_feed(text):
    root=ElementTree.fromstring(text)
    def tag(e): return e.tag.split('}')[-1]
    records=[]
    for entry in root.iter():
        if tag(entry) not in ('item','entry'): continue
        record={}
        for child in entry:
            key=tag(child)
            if key in ('title','link','pubDate','published','updated','description','summary','content'):
                record[key]=(child.attrib.get('href') or ''.join(child.itertext()))[:3000]
        records.append(record)
        if len(records)>=30: break
    if not records: raise ValueError('This URL did not return RSS/Atom entries.')
    return records

async def read_source(url,enabled,tool=None):
    if tool and tool['method']!='GET': raise ValueError('Action APIs require separate human approval.')
    headers=read_headers(tool) if tool else {}
    text,content_type,final_url,_=await public_request(url,headers=headers)
    text=redact(text,headers)
    path=urlsplit(final_url).path.lower()
    kind=tool['format'] if tool else 'json' if 'json' in content_type or path.endswith('.json') else 'csv' if 'csv' in content_type or path.endswith('.csv') else 'rss' if any(v in content_type for v in ('xml','rss','atom')) or path.endswith(('.rss','.xml','.atom')) else 'website'
    permitted={'json':{'JSON data','API documentation'},'csv':{'CSV data'},'rss':{'News & RSS'},'website':{'Read websites','API documentation'}}
    if not tool and not set(enabled)&permitted[kind]: raise ValueError(f'The {kind} reader is not enabled for this agent.')
    title=tool['name'] if tool else urlsplit(final_url).hostname
    metadata={}
    if kind=='json':
        data=json.loads(text);rows=rows_from_json(data)
        if 'Statistics' in enabled: metadata['statistics']=column_stats(rows)
        excerpt=json.dumps(data)[:16000]
        if 'API documentation' in enabled and isinstance(data,dict) and 'paths' in data:
            metadata['apiEndpoints']={k:list(v) if isinstance(v,dict) else v for k,v in list(data['paths'].items())[:50]}
    elif kind=='csv':
        reader=csv.DictReader(io.StringIO(text));rows=[]
        for i,row in enumerate(reader):
            if i>=500: break
            rows.append(row)
        if not rows: raise ValueError('The CSV source is empty or has no data rows.')
        metadata['statistics']=column_stats(rows) if 'Statistics' in enabled else {'sampleRows':len(rows),'maximumRows':500}
        excerpt=json.dumps(rows)[:16000]
    elif kind=='rss': excerpt=json.dumps(parse_feed(text))[:16000]
    else:
        if not any(v in content_type for v in ('text/','html')): raise ValueError('This website reader accepts HTML or text, not binary files.')
        match=re.search(r'<title[^>]*>(.*?)</title>',text,re.I|re.S)
        if match and not tool: title=unescape(match.group(1)).strip()
        text=re.sub(r'<(script|style)[^>]*>.*?</\1>',' ',text,flags=re.I|re.S)
        excerpt=re.sub(r'\s+',' ',unescape(re.sub(r'<[^>]+>',' ',text)))[:16000]
    if metadata: excerpt='COMPUTED DATA: '+json.dumps(metadata)+'\nSOURCE SAMPLE: '+excerpt
    return {'title':title,'url':final_url,'excerpt':excerpt,'provider':{'json':'JSON API','csv':'CSV dataset','rss':'RSS / Atom','website':'Public website'}[kind],'retrievalType':kind,'metadata':metadata}