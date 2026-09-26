"""Bounded public-only HTTP, with DNS pinned at connection time and no action retries."""
import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit, urljoin
import aiohttp
from aiohttp.abc import AbstractResolver

def validate_url(url):
    parsed=urlsplit(url)
    if parsed.scheme not in ('http','https') or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None,80,443):
        raise ValueError('Use a public HTTP(S) URL on port 80 or 443, without embedded credentials.')
    host=parsed.hostname.lower().rstrip('.')
    if host=='localhost' or host.endswith(('.localhost','.local','.internal')):
        raise ValueError('Private-network URLs are not allowed.')
    try: address=ipaddress.ip_address(host)
    except ValueError: address=None
    if address and not address.is_global: raise ValueError('Private-network URLs are not allowed.')
    return parsed

class PublicResolver(AbstractResolver):
    async def resolve(self,host,port=0,family=socket.AF_INET):
        answers=await asyncio.get_running_loop().getaddrinfo(host,port,type=socket.SOCK_STREAM,family=family)
        if not answers or any(not ipaddress.ip_address(a[4][0]).is_global for a in answers):
            raise ValueError('This hostname resolves to a private network.')
        return [{'hostname':host,'host':a[4][0],'port':port,'family':a[0],'proto':a[2],'flags':socket.AI_NUMERICHOST} for a in answers]
    async def close(self): pass

async def public_request(url,method='GET',headers=None,body=None):
    headers=headers or {}
    if headers and validate_url(url).scheme!='https': raise ValueError('Secret headers require HTTPS.')
    async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(resolver=PublicResolver(),use_dns_cache=False),timeout=aiohttp.ClientTimeout(total=20),trust_env=False) as session:
        for attempt in range(4):
            validate_url(url)
            async with session.request(method,url,headers={'User-Agent':'Agent.ws Research/1.0',**headers},json=body if method=='POST' else None,allow_redirects=False) as response:
                if 300<=response.status<400:
                    if method!='GET' or headers: raise ValueError('Redirects are blocked for actions and authenticated requests.')
                    url=urljoin(url,response.headers.get('Location',''));continue
                if response.status>=400: raise ValueError(f'The endpoint returned HTTP {response.status}.')
                chunks=[];size=0
                async for chunk in response.content.iter_chunked(16384):
                    size+=len(chunk)
                    if size>350000: raise ValueError('Response exceeds the 350 KB tool limit.')
                    chunks.append(chunk)
                return b''.join(chunks).decode('utf-8',errors='replace'),response.headers.get('Content-Type',''),url,response.status
    raise ValueError('Too many redirects.')