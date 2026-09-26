import secrets
from datetime import timedelta, datetime
from pymongo import ReturnDocument
from db import db, now, stamp

HOLDING_REQUIREMENT = 100000

async def refresh_agent(agent):
    if not agent or agent.get('deletedAt'): return agent
    if agent.get('energyResetAt') and datetime.fromisoformat(agent['energyResetAt']) <= now():
        await db.agents.update_one({'id': agent['id'], 'energyResetAt': agent['energyResetAt']}, {'$set': {'energy': 100, 'energyResetAt': None}})
        agent = await db.agents.find_one({'id': agent['id']}, {'_id': 0})
    wallet = await db.wallets.find_one({'id': agent['creatorWallet']}, {'_id': 0, 'balance': 1})
    balance = wallet['balance'] if wallet else 0
    status = 'SLEEPING' if balance < HOLDING_REQUIREMENT else 'WORKING' if agent.get('workingMissionId') else 'RESTING' if agent['energy'] < 10 else 'ACTIVE'
    if status != agent['status']:
        await db.agents.update_one({'id': agent['id'], 'deletedAt': {'$exists': False}}, {'$set': {'status': status}})
        agent['status'] = status
    return agent

async def settle_mission(mission, agent):
    """Idempotent demo ledger. Integers only; a single atomic pool update reserves each roll."""
    mid = mission['id']
    if 'rewardRoll' not in mission:
        roll = secrets.randbelow(100)
        rolled_cents = 20 if roll < 40 else 0 if roll < 80 else 100
        await db.missions.update_one({'id': mid, 'rewardRoll': {'$exists': False}}, {'$set': {'rewardRoll': roll, 'rolledCents': rolled_cents}})
    mission = await db.missions.find_one({'id': mid}, {'_id': 0})
    amount = mission['rolledCents']
    ledger = {'missionId': mid, 'agentId': agent['id'], 'amountCents': amount, 'timestamp': stamp(), 'transactionStatus': 'DEMO_CREDIT', 'poolSource': 'Demo creator-fee reserve'}
    await db.pool.update_one({'id': 'main', 'balanceCents': {'$gte': amount}, 'rewards.missionId': {'$ne': mid}}, {'$inc': {'balanceCents': -amount}, '$push': {'rewards': ledger}})
    pool = await db.pool.find_one({'id': 'main'}, {'_id': 0})
    reward = next((r for r in pool['rewards'] if r['missionId'] == mid), None)
    if reward is None:
        ledger.update(amountCents=0, transactionStatus='POOL_EMPTY')
        await db.pool.update_one({'id': 'main', 'rewards.missionId': {'$ne': mid}}, {'$push': {'rewards': ledger}})
        pool = await db.pool.find_one({'id': 'main'}, {'_id': 0})
        reward = next(r for r in pool['rewards'] if r['missionId'] == mid)
    agent = await db.agents.find_one({'id': agent['id']}, {'_id': 0})
    reset = agent.get('energyResetAt') or (now() + timedelta(hours=5)).isoformat()
    await db.agents.update_one({'id': agent['id'], 'settledMissionIds': {'$ne': mid}}, {
        '$inc': {'energy': -10, 'treasuryCents': reward['amountCents'], 'jobsCompleted': 1},
        '$set': {'energyResetAt': reset},
        '$addToSet': {'settledMissionIds': mid},
        '$push': {'history': {'event': 'Mission completed', 'timestamp': stamp(), 'missionId': mid, 'rewardCents': reward['amountCents']}}
    })
    await db.agents.update_one({'id': agent['id'], 'workingMissionId': mid}, {'$set': {'workingMissionId': None}})
    await db.missions.update_one({'id': mid, 'status': {'$ne': 'COMPLETED'}}, {'$set': {'status': 'COMPLETED', 'phaseDetail': 'Report complete and saved to the private work feed.', 'completedAt': stamp(), 'rewardAmount': reward['amountCents'] / 100, 'transactionStatus': reward['transactionStatus']}, '$push': {'events': {'status': 'COMPLETED', 'timestamp': stamp(), 'detail': 'Report saved. Energy and discovery recorded.'}}})
    await refresh_agent(await db.agents.find_one({'id': agent['id']}, {'_id': 0}))