"""Cleanup UI-created iteration5 test records by explicit test agent names."""

import os
from pathlib import Path
from pymongo import MongoClient


def env_value(key: str, path: str) -> str | None:
    if os.environ.get(key):
        return os.environ[key]
    p = Path(path)
    if not p.exists():
        return None
    for line in p.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"')
    return None


def main() -> None:
    mongo_url = env_value("MONGO_URL", "/app/backend/.env")
    db_name = env_value("DB_NAME", "/app/backend/.env")
    if not mongo_url or not db_name:
        print("Missing MONGO_URL/DB_NAME; skipping cleanup")
        return

    names = {
        "InterdisciplinaryResearchAssistantAtlasX",
        "OwnedActorCheckAgentXXYY",
    }

    client = MongoClient(mongo_url)
    db = client[db_name]
    try:
        agents = list(db.agents.find({"name": {"$in": list(names)}}))
        if not agents:
            print("No iteration5 UI agents found")
            return

        agent_ids = [a["id"] for a in agents]
        wallet_ids = [a.get("creatorWallet") for a in agents if a.get("creatorWallet")]
        mission_ids = [m["id"] for m in db.missions.find({"agentId": {"$in": agent_ids}}, {"id": 1})]

        if mission_ids:
            db.missions.delete_many({"id": {"$in": mission_ids}})
        db.tool_actions.delete_many({"agentId": {"$in": agent_ids}})
        db.agents.delete_many({"id": {"$in": agent_ids}})

        if wallet_ids:
            db.sessions.delete_many({"walletId": {"$in": wallet_ids}})
            db.wallets.delete_many({"id": {"$in": wallet_ids}})

        print(
            f"Removed agents={len(agent_ids)} missions={len(mission_ids)} wallets={len(set(wallet_ids))}"
        )
    finally:
        client.close()


if __name__ == "__main__":
    main()
