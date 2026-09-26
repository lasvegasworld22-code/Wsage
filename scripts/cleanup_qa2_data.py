import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient


def main():
    load_dotenv(Path(__file__).resolve().parents[1] / 'backend' / '.env')
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = MongoClient(mongo_url)
    db = client[db_name]

    try:
        qa2_agents = list(db.agents.find({"name": {"$regex": r"^QA2_"}}, {"_id": 0, "id": 1}))
        agent_ids = [a["id"] for a in qa2_agents]

        qa2_missions = list(
            db.missions.find(
                {
                    "$or": [
                        {"agentName": {"$regex": r"^QA2_"}},
                        {"agentId": {"$in": agent_ids}} if agent_ids else {"agentId": "__none__"},
                    ]
                },
                {"_id": 0, "id": 1},
            )
        )
        mission_ids = [m["id"] for m in qa2_missions]

        if db.missions.count_documents({'id': {'$in': mission_ids}, 'status': {'$nin': ['COMPLETED', 'FAILED']}}):
            raise RuntimeError('QA work is still in progress; finish or cancel it before cleanup.')

        if mission_ids:
            pool = db.pool.find_one({"id": "main"}) or {}
            for reward in pool.get("rewards", []):
                if reward.get("missionId") in mission_ids:
                    db.pool.update_one(
                        {"id": "main", "rewards.missionId": reward["missionId"]},
                        {
                            "$pull": {"rewards": {"missionId": reward["missionId"]}},
                            "$inc": {"balanceCents": reward.get("amountCents", 0)},
                        },
                    )

        if mission_ids:
            db.missions.delete_many({"id": {"$in": mission_ids}})
        if agent_ids:
            db.agents.delete_many({"id": {"$in": agent_ids}})

        print({"removed_agents": len(agent_ids), "removed_missions": len(mission_ids)})
    finally:
        client.close()


if __name__ == "__main__":
    main()
