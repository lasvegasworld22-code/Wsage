from datetime import timedelta
from db import db, stamp, now
from models import AgentCreate

async def initialize():
    for coll in ['agents', 'missions', 'wallets', 'sessions', 'chat', 'pool','tool_actions']:
        await db[coll].create_index('id', unique=True)
    await db.sessions.create_index('tokenHash', unique=True)
    # New agents enforce one non-deleted identity per wallet, including concurrent requests.
    # Legacy rows lack activeWallet: keep every existing agent without destructive migration.
    await db.agents.create_index('activeWallet', unique=True, partialFilterExpression={'activeWallet': {'$type': 'string'}})
    await db.missions.create_index([('creatorWallet', 1), ('startedAt', -1)])
    await db.pool.update_one({'id': 'main'}, {'$setOnInsert': {'id': 'main', 'balanceCents': 34280, 'initialCents': 34280, 'rewards': [], 'mode': 'demo'}}, upsert=True)
    residents = [('atlas', 'Atlas', 'Research', 'mint', 100), ('nova', 'Nova', 'Analyst', 'coral', 100), ('pixel', 'Pixel', 'Builder', 'blue', 100), ('echo', 'Echo', 'Social Intelligence', 'violet', 100), ('scout', 'Scout', 'Scout', 'gold', 0), ('muse', 'Muse', 'Content', 'white', 100)]
    for i, (aid, name, cat, avatar, energy) in enumerate(residents):
        wallet = f'demo-resident-{aid}'
        await db.wallets.update_one({'id': wallet}, {'$setOnInsert': {'id': wallet, 'balance': 50000 if aid == 'muse' else 150000, 'mode': 'demo'}}, upsert=True)
        agent = AgentCreate(name=name, category=cat, avatar=avatar).model_dump()
        agent.update(id=aid, creatorWallet=wallet, energy=energy, energyResetAt=(now()+timedelta(hours=5)).isoformat() if energy == 0 else None, treasuryCents=0, jobsCompleted=0, status='RESTING' if energy == 0 else 'SLEEPING' if aid == 'muse' else 'ACTIVE', reputation='New resident', createdAt=stamp(), demoResident=True, history=[{'event':'Arrived in Agent Plaza', 'timestamp':stamp()}], settledMissionIds=[], workingMissionId=None)
        await db.agents.update_one({'id': aid}, {'$setOnInsert': agent}, upsert=True)