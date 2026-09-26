import json, os, uuid
from cryptography.fernet import Fernet
from safe_http import validate_url

def cipher(): return Fernet(os.environ['TOOL_SECRET_KEY'].encode())

def protect_tools(tools,existing=None):
    old={t['id']:t for t in existing or []}
    result=[];seen=set()
    for tool in tools:
        item=tool.copy();validate_url(item['url'])
        item['id']=item.get('id') or str(uuid.uuid4())
        if item['id'] in seen: raise ValueError('Each custom tool must have a unique ID.')
        seen.add(item['id'])
        headers=item.pop('headers',None)
        if headers and not item['url'].startswith('https://'): raise ValueError('Use HTTPS for a tool with secret headers.')
        previous=old.get(item['id'])
        if headers is None and previous and previous['url']!=item['url']:
            raise ValueError('Re-enter or clear secret headers when changing a tool URL.')
        item['secretHeaders']=cipher().encrypt(json.dumps(headers).encode()).decode() if headers else previous.get('secretHeaders','') if headers is None and previous else ''
        item['headerNames']=list(headers) if headers is not None else previous.get('headerNames',[]) if previous else []
        result.append(item)
    return result

def read_headers(tool):
    encrypted=tool.get('secretHeaders')
    return json.loads(cipher().decrypt(encrypted.encode())) if encrypted else {}

def redact(text,headers):
    for value in headers.values():
        if value:
            text=text.replace(value,'[REDACTED]').replace(json.dumps(value)[1:-1],'[REDACTED]')
    return text

def visible_tools(tools):
    return [{k:v for k,v in t.items() if k not in ('secretHeaders','headers')} for t in tools]