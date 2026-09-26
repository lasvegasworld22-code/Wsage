"""Only explicit owner approval can execute one exact, persisted POST request."""
import json, uuid
from fastapi import HTTPException
from db import db, stamp
from safe_http import public_request
from tool_config import read_headers, redact

def visible_action(action):
    return {k:v for k,v in action.items() if k not in ('_id','toolSnapshot')}

async def draft_action(agent,data,user):
    tool=next((t for t in agent.get('customTools',[]) if t['id']==data.toolId),None)
    if not tool or tool['method']!='POST': raise HTTPException(422,'Select a configured action API.')
    action={'id':str(uuid.uuid4()),'agentId':agent['id'],'creatorWallet':user['id'],'toolId':tool['id'],'toolName':tool['name'],'url':tool['url'],'method':'POST','body':data.body,'headerNames':tool.get('headerNames',[]),'status':'PENDING','createdAt':stamp(),'toolSnapshot':tool}
    await db.tool_actions.insert_one(action.copy())
    return visible_action(action)

async def owned_action(action_id,user):
    action=await db.tool_actions.find_one({'id':action_id,'creatorWallet':user['id']},{'_id':0})
    if not action: raise HTTPException(404,'Private tool request not found.')
    return action

async def execute_action(action):
    headers=read_headers(action['toolSnapshot'])
    try:
        text,kind,_,status=await public_request(action['url'],method='POST',headers=headers,body=action['body'])
        text=redact(text,headers)
        result={'status':'SUCCEEDED','httpStatus':status,'result':text[:16000],'completedAt':stamp()}
    except Exception:
        # A timeout might happen AFTER the remote action. Never retry automatically.
        result={'status':'FAILED_OR_UNKNOWN','error':'The endpoint did not confirm success. The action may have reached it. Check the destination before creating another request. No automatic retry was sent.','completedAt':stamp()}
    await db.tool_actions.update_one({'id':action['id'],'status':'RUNNING'},{'$set':result})

async def approve_action(action,user,background):
    active=await db.agents.find_one({'id':action['agentId'],'creatorWallet':user['id'],'deletedAt':{'$exists':False}},{'_id':0,'id':1})
    if not active: raise HTTPException(409,'The agent is no longer active in the plaza.')
    lock=await db.tool_actions.update_one({'id':action['id'],'status':'PENDING'},{'$set':{'status':'RUNNING','approvedAt':stamp()}})
    if not lock.modified_count: raise HTTPException(409,'This request has already been approved or rejected. It will not be sent again.')
    background.add_task(execute_action,action)
    return {**visible_action(action),'status':'RUNNING'}