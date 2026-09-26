"""Core API regression coverage for Agent.ws wallet, agent, mission, privacy, and chat flows."""

import os
import time
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient


def _frontend_backend_url() -> str:
    env_url = os.environ.get("REACT_APP_BACKEND_URL")
    if env_url:
        return env_url.rstrip("/")

    env_file = Path("/app/frontend/.env")
    if not env_file.exists():
        pytest.skip("frontend/.env missing; cannot resolve REACT_APP_BACKEND_URL")

    for line in env_file.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            value = line.split("=", 1)[1].strip()
            if value:
                return value.rstrip("/")

    pytest.skip("REACT_APP_BACKEND_URL not found in environment or frontend/.env")


def _backend_env_value(key: str) -> str | None:
    env_file = Path("/app/backend/.env")
    if not env_file.exists():
        return None
    for line in env_file.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"')
    return None


BASE_URL = _frontend_backend_url()


@pytest.fixture
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def wallet_session(api_client):
    r = api_client.post(f"{BASE_URL}/api/session", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("token"), str) and data["token"]
    assert data["wallet"]["balance"] == 150000

    api_client.headers.update({"Authorization": f"Bearer {data['token']}"})
    return {"token": data["token"], "wallet": data["wallet"], "client": api_client}


@pytest.fixture
def second_wallet_session(api_client):
    r = api_client.post(f"{BASE_URL}/api/session", timeout=30)
    assert r.status_code == 200
    data = r.json()
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {data['token']}"})
    return {"token": data["token"], "wallet": data["wallet"], "client": session}


@pytest.fixture
def created_agents_and_missions():
    data = {"wallet_ids": set(), "agent_ids": [], "mission_ids": []}
    yield data
    mongo_url = _backend_env_value("MONGO_URL")
    db_name = _backend_env_value("DB_NAME")
    if not mongo_url or not db_name:
        return
    client = MongoClient(mongo_url)
    db = client[db_name]
    try:
        # Let request-started demo work finish before removing its documents.
        deadline = time.time() + 480
        while data['mission_ids'] and time.time() < deadline and db.missions.count_documents({'id': {'$in': data['mission_ids']}, 'status': {'$nin': ['COMPLETED', 'FAILED']}}):
            time.sleep(1)
        pool = db.pool.find_one({'id': 'main'})
        for reward in (pool or {}).get('rewards', []):
            if reward['missionId'] in data['mission_ids']:
                db.pool.update_one({'id': 'main', 'rewards.missionId': reward['missionId']}, {'$pull': {'rewards': {'missionId': reward['missionId']}}, '$inc': {'balanceCents': reward['amountCents']}})
        if data["mission_ids"]:
            db.missions.delete_many({"id": {"$in": data["mission_ids"]}})
        if data["agent_ids"]:
            db.agents.delete_many({"id": {"$in": data["agent_ids"]}})
        if data["wallet_ids"]:
            db.chat.delete_many({"walletId": {"$in": list(data['wallet_ids'])}})
            db.sessions.delete_many({"walletId": {"$in": list(data['wallet_ids'])}})
            db.wallets.delete_many({"id": {"$in": list(data['wallet_ids'])}})
    finally:
        client.close()


def _create_agent(client: requests.Session, wallet_id: str, tracker: dict, name: str = "TEST_Agent") -> dict:
    payload = {
        "name": name,
        "avatar": "mint",
        "category": "Research",
        "brainConfig": "OpenAI GPT-5.4",
        "strategy": "TEST strategy",
        "tools": ["Public search", "GitHub", "Read websites"],
        "dataSources": "Public websites and GitHub",
        "rules": "Cite sources.",
        "outputFormat": "Structured report",
        "behavior": "Careful & methodical",
        "energy": 999,
        "treasuryCents": 9999,
        "jobsCompleted": 999,
    }
    r = client.post(f"{BASE_URL}/api/agents", json=payload, timeout=30)
    assert r.status_code == 200
    agent = r.json()
    tracker["wallet_ids"].add(wallet_id)
    tracker["agent_ids"].append(agent["id"])
    return agent


def _wait_mission_complete(client: requests.Session, mission_id: str, timeout_sec: int = 70) -> dict:
    start = time.time()
    while time.time() - start < timeout_sec:
        r = client.get(f"{BASE_URL}/api/missions/{mission_id}", timeout=30)
        assert r.status_code == 200
        data = r.json()
        if data["status"] in ["COMPLETED", "FAILED"]:
            return data
        time.sleep(1.5)
    pytest.fail(f"Mission {mission_id} did not complete within {timeout_sec}s")


def test_health_and_world_shape(api_client):
    health = api_client.get(f"{BASE_URL}/api/", timeout=30)
    assert health.status_code == 200
    h = health.json()
    assert h["status"] == "online"
    assert h["walletMode"] == "demo"

    world = api_client.get(f"{BASE_URL}/api/world", timeout=30)
    assert world.status_code == 200
    w = world.json()
    assert isinstance(w["agents"], list)
    assert "pool" in w and "balanceUSDC" in w["pool"]


def test_session_connect_and_get(wallet_session):
    client = wallet_session["client"]
    s = client.get(f"{BASE_URL}/api/session", timeout=30)
    assert s.status_code == 200
    body = s.json()
    assert body["id"] == wallet_session["wallet"]["id"]
    assert body["balance"] == 150000


def test_creation_holding_gate_and_restore(wallet_session, created_agents_and_missions):
    client = wallet_session["client"]

    low = client.patch(f"{BASE_URL}/api/session/holdings", json={"balance": 50000}, timeout=30)
    assert low.status_code == 200
    assert low.json()["balance"] == 50000

    blocked = client.post(f"{BASE_URL}/api/agents", json={"name": "TEST_Blocked", "avatar": "mint", "category": "Research"}, timeout=30)
    assert blocked.status_code == 403
    assert "100,000" in blocked.json()["detail"]

    high = client.patch(f"{BASE_URL}/api/session/holdings", json={"balance": 150000}, timeout=30)
    assert high.status_code == 200
    assert high.json()["balance"] == 150000

    agent = _create_agent(client, wallet_session["wallet"]["id"], created_agents_and_missions, name="TEST_RestoreCreate")
    assert agent["status"] == "ACTIVE"


def test_create_agent_ignores_injected_sensitive_fields(wallet_session, created_agents_and_missions):
    agent = _create_agent(wallet_session["client"], wallet_session["wallet"]["id"], created_agents_and_missions, name="TEST_Injected")
    assert agent["energy"] == 100
    assert agent["treasuryCents"] == 0
    assert agent["jobsCompleted"] == 0


def test_private_feed_auth_and_cross_wallet_forbidden(wallet_session, second_wallet_session, created_agents_and_missions):
    owner_client = wallet_session["client"]
    other_client = second_wallet_session["client"]

    agent = _create_agent(owner_client, wallet_session["wallet"]["id"], created_agents_and_missions, name="TEST_Privacy")

    owner_feed = owner_client.get(f"{BASE_URL}/api/agents/{agent['id']}/missions", timeout=30)
    assert owner_feed.status_code == 200
    assert isinstance(owner_feed.json(), list)

    forbidden = other_client.get(f"{BASE_URL}/api/agents/{agent['id']}/missions", timeout=30)
    assert forbidden.status_code == 403

    unauth = requests.get(f"{BASE_URL}/api/missions", timeout=30)
    assert unauth.status_code == 401


def test_public_agent_profile_does_not_expose_private_mission_fields(wallet_session, created_agents_and_missions):
    client = wallet_session["client"]
    agent = _create_agent(client, wallet_session["wallet"]["id"], created_agents_and_missions, name="TEST_PublicProfile")

    profile = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30)
    assert profile.status_code == 200
    body = profile.json()
    assert "workingMissionId" not in body
    assert "settledMissionIds" not in body
    assert "mission" not in body
    assert "output" not in body


def test_demo_mission_settlement_energy_jobs_reward_consistency(wallet_session, created_agents_and_missions):
    client = wallet_session["client"]
    agent = _create_agent(client, wallet_session["wallet"]["id"], created_agents_and_missions, name="TEST_MissionEconomy")

    before_agent = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()
    before_world = requests.get(f"{BASE_URL}/api/world", timeout=30).json()
    assert "pool" in before_world

    start = client.post(
        f"{BASE_URL}/api/missions",
        json={"agentId": agent["id"], "mission": "Find and summarize three open-source AI agent repos from public sources.", "mode": "demo"},
        timeout=30,
    )
    assert start.status_code == 202
    m = start.json()
    created_agents_and_missions["mission_ids"].append(m["id"])
    assert m["status"] == "MISSION RECEIVED"

    done = _wait_mission_complete(client, m["id"])
    assert done["status"] == "COMPLETED"
    assert done["mode"] == "demo"
    assert "simulated report" in done["output"].lower()
    assert done["sources"] == []

    after_agent = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()
    after_world = requests.get(f"{BASE_URL}/api/world", timeout=30).json()
    assert "pool" in after_world

    assert before_agent["energy"] - after_agent["energy"] == 10
    assert after_agent["jobsCompleted"] == before_agent["jobsCompleted"] + 1

    reward = float(done["rewardAmount"])
    treasury_delta = (after_agent["treasuryCents"] - before_agent["treasuryCents"]) / 100
    assert round(treasury_delta, 2) == round(reward, 2)
    assert done["transactionStatus"] in ["DEMO_CREDIT", "POOL_EMPTY"]


def test_no_double_settlement_effect_after_completion(wallet_session, created_agents_and_missions):
    client = wallet_session["client"]
    agent = _create_agent(client, wallet_session["wallet"]["id"], created_agents_and_missions, name="TEST_NoDouble")

    before = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()
    start = client.post(
        f"{BASE_URL}/api/missions",
        json={"agentId": agent["id"], "mission": "Summarize GitHub agent framework trends in simple terms.", "mode": "demo"},
        timeout=30,
    )
    assert start.status_code == 202
    mission_id = start.json()["id"]
    created_agents_and_missions["mission_ids"].append(mission_id)

    done = _wait_mission_complete(client, mission_id)
    assert done["status"] == "COMPLETED"
    after_once = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()

    time.sleep(3)
    after_wait = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()

    assert after_once["jobsCompleted"] == before["jobsCompleted"] + 1
    assert after_wait["jobsCompleted"] == after_once["jobsCompleted"]
    assert after_wait["treasuryCents"] == after_once["treasuryCents"]


def test_concurrent_missions_single_lock(wallet_session, created_agents_and_missions):
    client = wallet_session["client"]
    agent = _create_agent(client, wallet_session["wallet"]["id"], created_agents_and_missions, name="TEST_Concurrent")

    payload = {"agentId": agent["id"], "mission": "Collect current GitHub metadata on open-source AI agents.", "mode": "demo"}
    first = client.post(f"{BASE_URL}/api/missions", json=payload, timeout=30)
    second = client.post(f"{BASE_URL}/api/missions", json=payload, timeout=30)

    assert first.status_code == 202
    created_agents_and_missions["mission_ids"].append(first.json()["id"])
    assert second.status_code == 409
    assert "already has a mission" in second.json()["detail"]


def test_resting_prevents_mission_then_server_time_refill(wallet_session, created_agents_and_missions):
    client = wallet_session["client"]
    agent = _create_agent(client, wallet_session["wallet"]["id"], created_agents_and_missions, name="TEST_Resting")

    mongo_url = _backend_env_value("MONGO_URL")
    db_name = _backend_env_value("DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("Mongo env unavailable for energy reset manipulation test")

    mongo = MongoClient(mongo_url)
    db = mongo[db_name]
    try:
        db.agents.update_one({"id": agent["id"]}, {"$set": {"energy": 0, "energyResetAt": "2999-01-01T00:00:00+00:00"}})
    finally:
        mongo.close()

    blocked = client.post(
        f"{BASE_URL}/api/missions",
        json={"agentId": agent["id"], "mission": "Do a quick mission while resting state test is active.", "mode": "demo"},
        timeout=30,
    )
    assert blocked.status_code == 409
    assert "resting" in blocked.json()["detail"].lower()

    mongo = MongoClient(mongo_url)
    db = mongo[db_name]
    try:
        db.agents.update_one({"id": agent["id"]}, {"$set": {"energyResetAt": "2000-01-01T00:00:00+00:00"}})
    finally:
        mongo.close()

    refreshed = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30)
    assert refreshed.status_code == 200
    body = refreshed.json()
    assert body["energy"] == 100
    assert body["energyResetAt"] is None


def test_chat_persistence_and_rate_limit(wallet_session, created_agents_and_missions):
    client = wallet_session["client"]
    created_agents_and_missions['wallet_ids'].add(wallet_session['wallet']['id'])
    msg = f"TEST_chat_{int(time.time())}"

    sent = client.post(f"{BASE_URL}/api/chat", json={"message": msg}, timeout=30)
    assert sent.status_code == 200
    assert sent.json()["message"] == msg

    history = requests.get(f"{BASE_URL}/api/chat", timeout=30)
    assert history.status_code == 200
    assert any(x["message"] == msg for x in history.json())

    statuses = []
    for i in range(6):
        r = client.post(f"{BASE_URL}/api/chat", json={"message": f"TEST_rate_{i}_{time.time()}"}, timeout=30)
        statuses.append(r.status_code)
    assert 429 in statuses


def test_live_mission_uses_real_ai_and_sources(wallet_session, created_agents_and_missions):
    client = wallet_session["client"]

    health = requests.get(f"{BASE_URL}/api/", timeout=30).json()
    if not health.get("liveAI"):
        pytest.skip("Live AI key not configured")

    agent = _create_agent(client, wallet_session["wallet"]["id"], created_agents_and_missions, name="TEST_LiveMission")

    start = client.post(
        f"{BASE_URL}/api/missions",
        json={
            "agentId": agent["id"],
            "mission": "Use public GitHub and Wikipedia search to identify two multi-agent frameworks and cite the source URLs.",
            "mode": "live",
        },
        timeout=30,
    )
    assert start.status_code == 202
    mission_id = start.json()["id"]
    created_agents_and_missions["mission_ids"].append(mission_id)

    done = _wait_mission_complete(client, mission_id, timeout_sec=480)
    assert done["status"] == "COMPLETED"
    assert done["mode"] == "live"
    assert isinstance(done["output"], str) and len(done["output"].strip()) > 80
    assert isinstance(done["sources"], list)
    assert len(done["sources"]) > 0


def test_sleep_and_restore_preserves_identity_history_treasury(wallet_session, created_agents_and_missions):
    client = wallet_session["client"]
    agent = _create_agent(client, wallet_session["wallet"]["id"], created_agents_and_missions, name="TEST_SleepPreserve")

    # Complete one mission to establish history and potential treasury change.
    start = client.post(
        f"{BASE_URL}/api/missions",
        json={"agentId": agent["id"], "mission": "Create a concise demo mission summary for preservation testing.", "mode": "demo"},
        timeout=30,
    )
    assert start.status_code == 202
    mission_id = start.json()["id"]
    created_agents_and_missions["mission_ids"].append(mission_id)
    _ = _wait_mission_complete(client, mission_id)

    before_sleep = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()
    history_len_before = len(before_sleep["history"])
    treasury_before = before_sleep["treasuryCents"]

    low = client.patch(f"{BASE_URL}/api/session/holdings", json={"balance": 50000}, timeout=30)
    assert low.status_code == 200
    sleeping = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()
    assert sleeping["status"] == "SLEEPING"
    assert sleeping["name"] == before_sleep["name"]
    assert sleeping["treasuryCents"] == treasury_before
    assert len(sleeping["history"]) == history_len_before

    restore = client.patch(f"{BASE_URL}/api/session/holdings", json={"balance": 150000}, timeout=30)
    assert restore.status_code == 200
    active = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()
    assert active["status"] in ["ACTIVE", "RESTING"]
    assert active["name"] == before_sleep["name"]
    assert active["treasuryCents"] == treasury_before
    assert len(active["history"]) == history_len_before
