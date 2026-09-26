import asyncio, logging, time
from db import db, stamp, now
from datetime import datetime
from mission_timing import execution_window
from providers import live_execute, demo_execute
from research_pipeline import execute_research
from economy import settle_mission, refresh_agent

logger=logging.getLogger(__name__)

async def run_mission(mid):
    m=await db.missions.find_one({'id':mid},{'_id':0})
    if not m or m['status'] in ['COMPLETED','FAILED']: return
    a=await db.agents.find_one({'id':m['agentId']},{'_id':0})
    if not a: return
    if not m.get('deadlineAt'):
        timing=execution_window(a,m['mission'],m['startedAt'])
        await db.missions.update_one({'id':mid},{'$set':timing})
        m.update(timing)
    current_stage=m['status']
    async def stage(status,detail='',artifacts=None):
        nonlocal current_stage
        fields={'status':status,'phaseDetail':detail}
        if artifacts:
            fields.update({f'artifacts.{k}':v for k,v in artifacts.items()})
        update={'$set':fields}
        if current_stage!=status:
            update['$push']={'events':{'status':status,'timestamp':stamp(),'detail':detail}}
            current_stage=status
        await db.missions.update_one({'id':mid},update)
    last_write=0
    last_source_count=-1
    async def output(text,sources):
        nonlocal last_write,last_source_count
        if time.monotonic()-last_write<.35 and len(sources)==last_source_count: return
        last_write=time.monotonic()
        last_source_count=len(sources)
        await db.missions.update_one({'id':mid},{'$set':{'output':text,'sources':sources}})
    try:
        if m['status']!='SETTLING' and not m.get('researchReady'):
            provider=execute_research if m['mode']=='live' else demo_execute
            if m['mode']!='live': await stage('PLANNING','Preparing an illustrative execution.')
            remaining=(datetime.fromisoformat(m['deadlineAt'])-now()).total_seconds()-3
            if remaining<=0: raise TimeoutError('The five-minute research window expired. Try a narrower objective.')
            text,sources=await asyncio.wait_for(provider(m,a,stage,output),timeout=remaining)
            await db.missions.update_one({'id':mid},{'$set':{'output':text,'sources':sources,'researchReady':True,'phaseDetail':'Research and verification complete. Finalizing the report within its work window.'}})
        if m['status']!='SETTLING':
            # Pacing one request, not a recurring scheduler. Absolute time survives reload/restart.
            delay=(datetime.fromisoformat(m['expectedCompletionAt'])-now()).total_seconds()
            if delay>0: await asyncio.sleep(delay)
            await db.missions.update_one({'id':mid,'status':{'$nin':['COMPLETED','FAILED']}},{'$set':{'status':'SETTLING'}})
        current=await db.missions.find_one({'id':mid},{'_id':0})
        if not current or current['status'] in ['COMPLETED','FAILED']: return
        if not await db.agents.find_one({'id':a['id']},{'_id':0,'id':1}): return
        await settle_mission(current,a)
    except asyncio.CancelledError:
        raise # Preserve unfinished state for startup recovery.
    except Exception as exc:
        current=await db.missions.find_one({'id':mid},{'_id':0})
        if not current or current['status'] in ['COMPLETED','FAILED']: return
        logger.exception('Mission %s failed',mid)
        if current and current['status']=='SETTLING':
            # Economic settlement is recoverable and idempotent; do not mark as failed.
            return
        detail='The five-minute research window expired. Try a narrower objective.' if isinstance(exc,TimeoutError) else str(exc)[:220]
        await db.missions.update_one({'id':mid},{'$set':{'status':'FAILED','error':'Execution could not complete. '+detail, 'completedAt':stamp()}})
        await db.agents.update_one({'id':a['id'],'workingMissionId':mid},{'$set':{'workingMissionId':None}})
        await refresh_agent(await db.agents.find_one({'id':a['id']},{'_id':0}))