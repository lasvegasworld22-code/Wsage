from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from typing import Literal
from agent_catalog import PRESETS, TOOL_CATALOG, OUTPUT_FORMATS
from safe_http import validate_url
import json, re

CATEGORIES = ['Research', 'Analyst', 'Scout', 'Content', 'Builder', 'Social Intelligence']

class Document(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: str

class CustomTool(BaseModel):
    id: str = Field(default='',max_length=80)
    name: str = Field(min_length=2,max_length=60)
    url: str = Field(min_length=8,max_length=2048)
    method: Literal['GET','POST'] = 'GET'
    format: Literal['website','json','csv','rss'] = 'website'
    headers: dict[str,str] | None = None
    body: dict = Field(default_factory=dict)

    @field_validator('url')
    @classmethod
    def public_url(cls,value):
        validate_url(value)
        return value

    @field_validator('headers')
    @classmethod
    def safe_headers(cls,value):
        if value is None: return value
        if len(value)>10: raise ValueError('At most 10 headers are allowed.')
        forbidden={'host','content-length','connection','transfer-encoding','cookie','upgrade','proxy-authorization','accept-encoding'}
        for key,item in value.items():
            if not re.fullmatch(r'[A-Za-z0-9-]{1,80}',key) or key.lower() in forbidden or key.lower().startswith(('proxy-','x-forwarded-')) or len(item)>4096 or '\r' in item or '\n' in item:
                raise ValueError('Invalid or restricted request header.')
        return value

    @field_validator('body')
    @classmethod
    def bounded_body(cls,value):
        if len(json.dumps(value))>16000: raise ValueError('JSON payload must be below 16 KB.')
        return value

class AgentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=40)
    avatar: Literal['mint', 'coral', 'blue', 'gold', 'violet', 'white'] = 'mint'
    category: Literal['Research', 'Analyst', 'Scout', 'Content', 'Builder', 'Social Intelligence']
    brainConfig: Literal['OpenAI GPT-5.4'] = 'OpenAI GPT-5.4'
    strategy: str = Field(default='Compare multiple sources, cross-check claims, and produce concise findings.', max_length=3000)
    tools: list[str] = Field(default_factory=lambda: ['Public search', 'Read websites'],max_length=20)
    dataSources: str = Field(default='Public websites and GitHub', max_length=2000)
    rules: str = Field(default='Cite sources. Separate facts from uncertainty. Never trade or spend funds.', max_length=3000)
    outputFormat: str = 'Structured report'
    behavior: Literal['Careful & methodical', 'Curious & exploratory', 'Concise & direct'] = 'Careful & methodical'
    researchDepth: Literal['auto', 'quick', 'standard', 'deep'] = 'auto'
    additionalInstructions: str = Field(default='',max_length=2000)
    customTools: list[CustomTool] = Field(default_factory=list,max_length=8)

    @model_validator(mode='before')
    @classmethod
    def category_defaults(cls,data):
        if isinstance(data,dict):
            preset=PRESETS.get(data.get('category'),{})
            data={**{k:v for k,v in preset.items() if k in cls.model_fields},**data}
        return data

    @field_validator('tools')
    @classmethod
    def known_tools(cls,value):
        if any(t not in TOOL_CATALOG for t in value): raise ValueError('Unknown tool. Configure an optional custom URL/API instead.')
        return list(dict.fromkeys(value))

    @field_validator('outputFormat')
    @classmethod
    def known_format(cls,value):
        if value not in OUTPUT_FORMATS: raise ValueError('Select a supported output format.')
        return value

class ActionDraft(BaseModel):
    toolId: str
    body: dict = Field(default_factory=dict)
    _bounded = field_validator('body')(CustomTool.bounded_body.__func__)

class ActionApproval(BaseModel):
    confirmed: Literal[True]

class MissionCreate(BaseModel):
    agentId: str
    mission: str = Field(min_length=10, max_length=3000)
    mode: Literal['live', 'demo'] = 'live'

class ChatCreate(BaseModel):
    message: str = Field(min_length=1, max_length=500)

class HoldingsUpdate(BaseModel):
    balance: int = Field(ge=0, le=1000000)