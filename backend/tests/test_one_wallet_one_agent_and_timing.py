"""Focused regression tests for one-wallet-one-agent, delete guards, and mission timing windows."""

import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from datetime import datetime, timezone

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
    pytest.skip("REACT_APP_BACKEND_URL not found")


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
    r = None
    for _ in range(3):
        try:
            r = api_client.post(f"{BASE_URL}/api/session", timeout=60)
            if r.status_code == 200:
                break
        except requests.RequestException:
            time.sleep(1)
    assert r is not None and r.status_code == 200
    data = r.json()
    api_client.headers.update({"Authorization": f"Bearer {data['token']}"})
    return {"client": api_client, "token": data["token"], "wallet": data["wallet"]}


@pytest.fixture
def second_wallet(api_client):
    r = None
    for _ in range(3):
        try:
            r = api_client.post(f"{BASE_URL}/api/session", timeout=60)
            if r.status_code == 200:
                break
        except requests.RequestException:
            time.sleep(1)
    assert r is not None and r.status_code == 200
    data = r.json()
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {data['token']}"})
    return {"client": s, "token": data["token"], "wallet": data["wallet"]}


@pytest.fixture
def cleanup_data():
    tracker = {"wallet_ids": set(), "agent_ids": [], "mission_ids": []}
    yield tracker

    mongo_url = _backend_env_value("MONGO_URL")
    db_name = _backend_env_value("DB_NAME")
    if not mongo_url or not db_name:
        return

    mongo = MongoClient(mongo_url)
    db = mongo[db_name]
    try:
        if tracker["mission_ids"]:
            db.missions.update_many(
                {"id": {"$in": tracker["mission_ids"]}, "status": {"$nin": ["COMPLETED", "FAILED"]}},
                {"$set": {"status": "FAILED", "completedAt": datetime.now(timezone.utc).isoformat()}},
            )
            db.agents.update_many(
                {"workingMissionId": {"$in": tracker["mission_ids"]}},
                {"$set": {"workingMissionId": None}},
            )

        pool = db.pool.find_one({"id": "main"}) or {}
        for reward in pool.get("rewards", []):
            if reward.get("missionId") in tracker["mission_ids"]:
                db.pool.update_one(
                    {"id": "main", "rewards.missionId": reward["missionId"]},
                    {
                        "$pull": {"rewards": {"missionId": reward["missionId"]}},
                        "$inc": {"balanceCents": reward.get("amountCents", 0)},
                    },
                )

        if tracker["mission_ids"]:
            db.missions.delete_many({"id": {"$in": tracker["mission_ids"]}})
        if tracker["agent_ids"]:
            db.agents.delete_many({"id": {"$in": tracker["agent_ids"]}})
        if tracker["wallet_ids"]:
            ids = list(tracker["wallet_ids"])
            db.chat.delete_many({"walletId": {"$in": ids}})
            db.sessions.delete_many({"walletId": {"$in": ids}})
            db.wallets.delete_many({"id": {"$in": ids}})
    finally:
        mongo.close()


def _agent_payload(name: str, research_depth: str = "auto", behavior: str = "Careful & methodical") -> dict:
    return {
        "name": name,
        "avatar": "mint",
        "category": "Research",
        "brainConfig": "OpenAI GPT-5.4",
        "strategy": "Cross-check multiple sources and cite URLs.",
        "tools": ["Public search", "GitHub", "Read websites"],
        "dataSources": "Public websites and GitHub",
        "rules": "Cite every source. Separate facts from uncertainty.",
        "outputFormat": "Structured report",
        "behavior": behavior,
        "researchDepth": research_depth,
    }


def _create_agent(
    client: requests.Session,
    wallet_id: str,
    tracker: dict,
    name: str,
    research_depth: str = "auto",
    behavior: str = "Careful & methodical",
) -> dict:
    r = client.post(
        f"{BASE_URL}/api/agents",
        json=_agent_payload(name, research_depth, behavior),
        timeout=60,
    )
    assert r.status_code == 200
    agent = r.json()
    tracker["wallet_ids"].add(wallet_id)
    tracker["agent_ids"].append(agent["id"])
    return agent


def _wait_for_status(client: requests.Session, mission_id: str, timeout_sec: int = 300) -> dict:
    start = time.time()
    while time.time() - start < timeout_sec:
        r = client.get(f"{BASE_URL}/api/missions/{mission_id}", timeout=30)
        assert r.status_code == 200
        data = r.json()
        if data["status"] in ["COMPLETED", "FAILED"]:
            return data
        time.sleep(2)
    pytest.fail(f"Mission {mission_id} did not finish in {timeout_sec}s")


# one-wallet-one-agent concurrency and input validation
def test_concurrent_create_agent_allows_exactly_one_success(wallet_session, cleanup_data):
    token = wallet_session["token"]
    wallet_id = wallet_session["wallet"]["id"]
    cleanup_data["wallet_ids"].add(wallet_id)

    def hit_create(i: int):
        payload = _agent_payload(f"T{i}_Concurrent")
        return requests.post(
            f"{BASE_URL}/api/agents",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
            json=payload,
            timeout=45,
        )

    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(hit_create, range(6)))

    statuses = [r.status_code for r in results]
    assert statuses.count(200) == 1
    assert statuses.count(409) == 5

    created = [r.json() for r in results if r.status_code == 200][0]
    cleanup_data["agent_ids"].append(created["id"])


# independent wallets should still each create their own single identity
def test_independent_wallets_can_create_one_each(wallet_session, second_wallet, cleanup_data):
    one = _create_agent(wallet_session["client"], wallet_session["wallet"]["id"], cleanup_data, "W1_Agent")
    two = _create_agent(second_wallet["client"], second_wallet["wallet"]["id"], cleanup_data, "W2_Agent")
    cleanup_data["wallet_ids"].add(second_wallet["wallet"]["id"])
    assert one["creatorWallet"] != two["creatorWallet"]


# one-wallet-one-agent guard should block even if existing agent sleeps/rests
def test_creation_blocked_if_existing_agent_sleeping_or_resting(wallet_session, cleanup_data):
    client = wallet_session["client"]
    wallet_id = wallet_session["wallet"]["id"]
    a = _create_agent(client, wallet_id, cleanup_data, "GuardStateAgent")

    low = client.patch(f"{BASE_URL}/api/session/holdings", json={"balance": 50000}, timeout=30)
    assert low.status_code == 200
    sleep_block = client.post(f"{BASE_URL}/api/agents", json=_agent_payload("BlockedSleep"), timeout=30)
    assert sleep_block.status_code == 409

    restore = client.patch(f"{BASE_URL}/api/session/holdings", json={"balance": 150000}, timeout=30)
    assert restore.status_code == 200

    mongo_url = _backend_env_value("MONGO_URL")
    db_name = _backend_env_value("DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("Mongo env unavailable for resting-state setup")
    mongo = MongoClient(mongo_url)
    db = mongo[db_name]
    try:
        db.agents.update_one({"id": a["id"]}, {"$set": {"energy": 0}})
    finally:
        mongo.close()

    profile = client.get(f"{BASE_URL}/api/agents/{a['id']}", timeout=30)
    assert profile.status_code == 200
    assert profile.json()["status"] == "RESTING"

    rest_block = client.post(f"{BASE_URL}/api/agents", json=_agent_payload("BlockedRest"), timeout=30)
    assert rest_block.status_code == 409


# invalid inputs for create endpoint
def test_create_agent_invalid_inputs(wallet_session):
    client = wallet_session["client"]
    short_name = client.post(
        f"{BASE_URL}/api/agents",
        json={"name": "A", "avatar": "mint", "category": "Research"},
        timeout=30,
    )
    assert short_name.status_code == 422

    bad_avatar = client.post(
        f"{BASE_URL}/api/agents",
        json={"name": "BadAvatar", "avatar": "pink", "category": "Research"},
        timeout=30,
    )
    assert bad_avatar.status_code == 422


# owner-only delete and mission-in-progress delete guard
def test_delete_requires_owner_and_blocks_working_agent(wallet_session, second_wallet, cleanup_data):
    owner = wallet_session["client"]
    other = second_wallet["client"]
    cleanup_data["wallet_ids"].add(second_wallet["wallet"]["id"])
    agent = _create_agent(owner, wallet_session["wallet"]["id"], cleanup_data, "OwnerDeleteGuard")

    guest = requests.delete(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30)
    assert guest.status_code == 401
    other_delete = other.delete(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30)
    assert other_delete.status_code == 403

    m_start = owner.post(
        f"{BASE_URL}/api/missions",
        json={"agentId": agent["id"], "mission": "Summarize Python packaging basics from public docs.", "mode": "demo"},
        timeout=30,
    )
    assert m_start.status_code == 202
    mid = m_start.json()["id"]
    cleanup_data["mission_ids"].append(mid)

    blocked = owner.delete(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30)
    assert blocked.status_code == 409


# soft-delete should hide old agent and allow replacement
def test_delete_hides_agent_and_allows_recreate(wallet_session, cleanup_data):
    client = wallet_session["client"]
    wallet_id = wallet_session["wallet"]["id"]
    agent = _create_agent(client, wallet_id, cleanup_data, "DeleteThenRecreate")

    remove = client.delete(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30)
    assert remove.status_code == 200

    p = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30)
    assert p.status_code == 404

    world = requests.get(f"{BASE_URL}/api/world", timeout=30)
    assert world.status_code == 200
    ids = [a["id"] for a in world.json()["agents"]]
    assert agent["id"] not in ids

    mine = client.get(f"{BASE_URL}/api/agents?mine=true", timeout=30)
    assert mine.status_code == 200
    mine_ids = [a["id"] for a in mine.json()]
    assert agent["id"] not in mine_ids

    replacement = _create_agent(client, wallet_id, cleanup_data, "ReplacementAgent")
    assert replacement["id"] != agent["id"]


# depth windows and persisted schedule metadata at mission creation
@pytest.mark.parametrize(
    "depth,mission_text,min_sec,max_sec",
    [
        ("quick", "Quickly summarize this page: https://www.python.org/about/", 60, 120),
        ("standard", "Summarize Python release process from public docs with citations.", 120, 210),
        ("deep", "Deep comprehensive comparison of Python governance and release docs with citations.", 210, 295),
    ],
)
def test_mission_window_ranges_and_persisted_fields(wallet_session, cleanup_data, depth, mission_text, min_sec, max_sec):
    client = wallet_session["client"]
    agent = _create_agent(client, wallet_session["wallet"]["id"], cleanup_data, f"Timing_{depth}", depth)
    start = client.post(
        f"{BASE_URL}/api/missions",
        json={"agentId": agent["id"], "mission": mission_text, "mode": "demo"},
        timeout=30,
    )
    assert start.status_code == 202
    body = start.json()
    cleanup_data["mission_ids"].append(body["id"])

    assert body["researchDepth"] == depth
    assert min_sec <= body["targetDurationSeconds"] <= max_sec
    assert isinstance(body["expectedCompletionAt"], str) and body["expectedCompletionAt"]
    assert isinstance(body["deadlineAt"], str) and body["deadlineAt"]

    started = datetime.fromisoformat(body["startedAt"])
    due = datetime.fromisoformat(body["expectedCompletionAt"])
    deadline = datetime.fromisoformat(body["deadlineAt"])
    assert int((due - started).total_seconds()) == body["targetDurationSeconds"]
    assert int((deadline - started).total_seconds()) == 300


# automatic depth inference from mission semantics
def test_auto_depth_inference_deep_and_quick(wallet_session, cleanup_data):
    client = wallet_session["client"]

    quick_agent = _create_agent(
        client,
        wallet_session["wallet"]["id"],
        cleanup_data,
        "AutoQuick",
        "auto",
        behavior="Concise & direct",
    )
    quick = client.post(
        f"{BASE_URL}/api/missions",
        json={
            "agentId": quick_agent["id"],
            "mission": "Summarize python.org about page in 3 bullets: https://www.python.org/about/",
            "mode": "demo",
        },
        timeout=30,
    )
    assert quick.status_code == 202
    q = quick.json()
    cleanup_data["mission_ids"].append(q["id"])
    assert q["researchDepth"] == "quick"
    assert 60 <= q["targetDurationSeconds"] <= 120

    deep = client.post(
        f"{BASE_URL}/api/missions",
        json={
            "agentId": quick_agent["id"],
            "mission": "Do a deep comprehensive exhaustive analysis of Python governance and release docs.",
            "mode": "demo",
        },
        timeout=30,
    )
    # duplicate mission lock should block until first settles
    assert deep.status_code == 409


# real live GPT-5.4 quick mission e2e with timing and settlement checks
def test_live_quick_mission_end_to_end_with_real_sources(wallet_session, cleanup_data):
    client = wallet_session["client"]
    health = requests.get(f"{BASE_URL}/api/", timeout=30)
    assert health.status_code == 200
    if not health.json().get("liveAI"):
        pytest.skip("Live AI key not configured")

    agent = _create_agent(client, wallet_session["wallet"]["id"], cleanup_data, "LiveQuickMission", "quick")
    before_agent = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()

    launch = client.post(
        f"{BASE_URL}/api/missions",
        json={
            "agentId": agent["id"],
            "mission": "Read https://www.python.org/about/ and summarize documented facts concisely with source citations.",
            "mode": "live",
        },
        timeout=30,
    )
    assert launch.status_code == 202
    mission = launch.json()
    cleanup_data["mission_ids"].append(mission["id"])

    assert mission["researchDepth"] == "quick"
    assert 60 <= mission["targetDurationSeconds"] <= 120

    time.sleep(8)
    in_progress = client.get(f"{BASE_URL}/api/missions/{mission['id']}", timeout=30).json()
    assert in_progress["status"] != "COMPLETED"
    assert in_progress.get("rewardAmount") in [None, 0] or "rewardAmount" not in in_progress

    done = _wait_for_status(client, mission["id"], timeout_sec=300)
    assert done["status"] == "COMPLETED"
    assert isinstance(done.get("sources"), list) and len(done["sources"]) > 0
    assert isinstance(done.get("artifacts", {}).get("plan"), dict)
    assert isinstance(done.get("artifacts", {}).get("analysis"), str) and done["artifacts"]["analysis"].strip()
    assert isinstance(done.get("artifacts", {}).get("verification"), str) and done["artifacts"]["verification"].strip()

    started = datetime.fromisoformat(done["startedAt"])
    completed = datetime.fromisoformat(done["completedAt"])
    actual = int((completed - started).total_seconds())
    assert 60 <= actual <= 300

    after_agent = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()
    assert after_agent["jobsCompleted"] == before_agent["jobsCompleted"] + 1
    time.sleep(3)
    after_wait = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()
    assert after_wait["jobsCompleted"] == after_agent["jobsCompleted"]
