"""Owner-only preflight diagnostics. POST tools receive NO HTTP request."""
import asyncio, hashlib, json, os, re, socket, ssl, time, uuid
from datetime import datetime, timedelta
from urllib.parse import urlencode
import aiohttp
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from db import db, now, stamp
from safe_http import validate_url, PublicResolver
from research_tools import read_source, READ_TOOLS

def fingerprint(agent):
    config={key:agent.get(key) for key in ['customTools','tools','dataSources']}
    return hashlib.sha256(json.dumps(config,sort_keys=True).encode()).hexdigest()

def targets(agent):
    items=[{**tool,'sourceType':'custom'} for tool in agent.get('customTools',[])]
    used={t['url'] for t in items}
    if set(agent.get('tools',[]))&READ_TOOLS:
        for url in re.findall(r'https?://[^\s<>"\]]+',agent.get('dataSources',''))[:5]:
            url=url.rstrip('.,;)')
            if url not in used:
                items.append({'id':'source-'+hashlib.sha256(url.encode()).hexdigest()[:12],'name':'Preferred source','url':url,'method':'GET','sourceType':'preferred'});used.add(url)
    providers=[('GitHub','GITHUB_API_URL','/rate_limit'),('Academic papers','CROSSREF_API_URL','/works?rows=0'),('Public search','WIKIPEDIA_API_URL','?'+urlencode({'action':'query','format':'json','meta':'siteinfo'}))]
    for name,key,suffix in providers:
        if name in agent.get('tools',[]):
            items.append({'id':'provider-'+key.lower(),'name':name,'url':os.environ[key]+suffix,'method':'GET','format':'json','sourceType':'provider'})
    return items

async def probe_connection(url):
    parsed=validate_url(url);port=parsed.port or (443 if parsed.scheme=='https' else 80)
    answers=await PublicResolver().resolve(parsed.hostname,port,socket.AF_UNSPEC)
    last_error=None
    for address in answers[:3]:
        writer=None
        try:
            options={'ssl':ssl.create_default_context(),'server_hostname':parsed.hostname} if parsed.scheme=='https' else {}
            _,writer=await asyncio.wait_for(asyncio.open_connection(address['host'],port,**options),timeout=4)
            return
        except (OSError,asyncio.TimeoutError) as exc: last_error=exc
        finally:
            if writer:
                writer.close()
                try: await asyncio.wait_for(writer.wait_closed(),timeout=1)
                except (OSError,asyncio.TimeoutError): pass
    raise ConnectionError('Host connection failed') from last_error

def failure_message(exc):
    http=re.search(r'HTTP (\d{3})',str(exc))
    if http:
        code=int(http.group(1))
        if code in (401,403): return 'Credentials or access permissions need attention.'
        if code==404: return 'Endpoint not found (HTTP 404). Check the URL.'
        if code==429: return 'The provider is rate-limiting requests. Try again later.'
        return f'The endpoint returned HTTP {code}.'
    if isinstance(exc,(asyncio.TimeoutError,TimeoutError)): return 'Connection timed out. Try again or check the URL.'
    if isinstance(exc,json.JSONDecodeError): return 'The response is not valid JSON. Check the response format.'
    if isinstance(exc,(aiohttp.ClientError,OSError)): return 'The host could not be reached or its secure connection failed.'
    return 'The source could not be read. Check its URL, response format, and public access.'

async def inspect_target(target,agent,semaphore):
    async with semaphore:
        start=time.monotonic()
        result={key:target.get(key) for key in ['id','name','url','method','sourceType']}
        try:
            async with asyncio.timeout(12):
                if target['method']=='POST':
                    await probe_connection(target['url'])
                    result.update(status='LIMITED',message='Host reachable. POST was not sent; endpoint, credentials and payload remain unverified.')
                else:
                    tool=target if target['sourceType'] in ('custom','provider') else None
                    await read_source(target['url'],agent.get('tools',[]),tool)
                    result.update(status='READY',message='Source retrieved and response format validated.')
        except Exception as exc: result.update(status='ERROR',message=failure_message(exc))
        return {**result,'latencyMs':round((time.monotonic()-start)*1000),'checkedAt':stamp()}

async def get_health(agent):
    row=await db.tool_health.find_one({'id':agent['id'],'fingerprint':fingerprint(agent)},{'_id':0,'fingerprint':0,'runId':0})
    if row and (row['status']!='CHECKING' or datetime.fromisoformat(row['startedAt'])>now()-timedelta(seconds=70)):
        return row
    return {'id':agent['id'],'status':'UNCHECKED','checkedAt':None,'checks':[]}

async def run_checks(agent,run_id):
    semaphore=asyncio.Semaphore(4)
    checks=await asyncio.gather(*(inspect_target(t,agent,semaphore) for t in targets(agent)))
    await db.tool_health.update_one({'id':agent['id'],'runId':run_id},{'$set':{'status':'COMPLETE','checks':checks,'checkedAt':stamp()}})

async def start_checks(agent,background):
    run_id=str(uuid.uuid4());fp=fingerprint(agent)
    try:
        await db.tool_health.find_one_and_update(
            {'id':agent['id'],'$or':[{'status':{'$ne':'CHECKING'}},{'fingerprint':{'$ne':fp}},{'startedAt':{'$lt':(now()-timedelta(seconds=70)).isoformat()}}]},
            {'$set':{'creatorWallet':agent['creatorWallet'],'fingerprint':fp,'runId':run_id,'status':'CHECKING','checks':[],'startedAt':stamp(),'checkedAt':None}},
            upsert=True,projection={'_id':0},return_document=ReturnDocument.AFTER)
    except DuplicateKeyError:
        return await get_health(agent)
    background.add_task(run_checks,agent,run_id)
    return await get_health(agent)