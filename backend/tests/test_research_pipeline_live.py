"""Focused live research pipeline verification: stages, artifacts, sources, and settlement effects."""

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

    pytest.skip("REACT_APP_BACKEND_URL not found")


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
    api_client.headers.update({"Authorization": f"Bearer {data['token']}"})
    return {"wallet": data["wallet"], "client": api_client, "token": data["token"]}


@pytest.fixture
def cleanup_live_data(wallet_session):
    created = {"agent_ids": [], "mission_ids": [], "wallet_id": wallet_session["wallet"]["id"]}
    yield created

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        return

    mongo = MongoClient(mongo_url)
    db = mongo[db_name]
    try:
        deadline = time.time() + 480
        while created["mission_ids"] and time.time() < deadline:
            running = db.missions.count_documents(
                {"id": {"$in": created["mission_ids"]}, "status": {"$nin": ["COMPLETED", "FAILED"]}}
            )
            if running == 0:
                break
            time.sleep(1)

        pool = db.pool.find_one({"id": "main"}) or {}
        for reward in pool.get("rewards", []):
            if reward.get("missionId") in created["mission_ids"]:
                db.pool.update_one(
                    {"id": "main", "rewards.missionId": reward["missionId"]},
                    {
                        "$pull": {"rewards": {"missionId": reward["missionId"]}},
                        "$inc": {"balanceCents": reward.get("amountCents", 0)},
                    },
                )

        if created["mission_ids"]:
            db.missions.delete_many({"id": {"$in": created["mission_ids"]}})
        if created["agent_ids"]:
            db.agents.delete_many({"id": {"$in": created["agent_ids"]}})
        db.sessions.delete_many({"walletId": created["wallet_id"]})
        db.wallets.delete_many({"id": created["wallet_id"]})
    finally:
        mongo.close()


def _create_qa2_agent(client: requests.Session, cleanup_live_data: dict):
    payload = {
        "name": f"QA2_Live_{int(time.time())}",
        "avatar": "blue",
        "category": "Research",
        "brainConfig": "OpenAI GPT-5.4",
        "strategy": "Gather evidence from multiple public sources, compare claims, and cite URLs.",
        "tools": ["Public search", "GitHub", "Read websites"],
        "dataSources": "GitHub and public web pages",
        "rules": "Only include claims supported by retrieved sources.",
        "outputFormat": "Structured report",
        "behavior": "Careful & methodical",
    }
    r = client.post(f"{BASE_URL}/api/agents", json=payload, timeout=30)
    assert r.status_code == 200
    agent = r.json()
    cleanup_live_data["agent_ids"].append(agent["id"])
    return agent


def _create_qa2_agent_with_tools(client: requests.Session, cleanup_live_data: dict, tools: list[str]):
    payload = {
        "name": f"QA2_Tools_{int(time.time())}",
        "avatar": "mint",
        "category": "Research",
        "brainConfig": "OpenAI GPT-5.4",
        "strategy": "Use only enabled tools and cite evidence.",
        "tools": tools,
        "dataSources": "Configured sources only",
        "rules": "Do not use disabled tools.",
        "outputFormat": "Structured report",
        "behavior": "Careful & methodical",
    }
    r = client.post(f"{BASE_URL}/api/agents", json=payload, timeout=30)
    assert r.status_code == 200
    agent = r.json()
    cleanup_live_data["agent_ids"].append(agent["id"])
    return agent


def _wait_for_terminal(client: requests.Session, mission_id: str, timeout_sec: int = 480):
    start = time.time()
    snapshots = []
    while time.time() - start < timeout_sec:
        r = client.get(f"{BASE_URL}/api/missions/{mission_id}", timeout=30)
        assert r.status_code == 200
        data = r.json()
        snapshots.append(data)
        if data["status"] in ["COMPLETED", "FAILED"]:
            return data, snapshots
        time.sleep(2)
    pytest.fail(f"Mission {mission_id} did not reach terminal status within {timeout_sec}s")


# mission pipeline and settlement behavior for live execution
def test_live_pipeline_artifacts_events_sources_and_settlement(wallet_session, cleanup_live_data):
    client = wallet_session["client"]

    health = requests.get(f"{BASE_URL}/api/", timeout=30).json()
    if not health.get("liveAI"):
        pytest.skip("Live AI key not configured")

    agent = _create_qa2_agent(client, cleanup_live_data)
    before = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()

    mission_text = (
        "Research AutoGen and CrewAI from public GitHub and documentation sources. "
        "Compare architecture, strengths, and tradeoffs with cited URLs."
    )
    launch = client.post(
        f"{BASE_URL}/api/missions",
        json={"agentId": agent["id"], "mission": mission_text, "mode": "live"},
        timeout=30,
    )
    assert launch.status_code == 202
    mission = launch.json()
    cleanup_live_data["mission_ids"].append(mission["id"])
    assert mission["status"] == "MISSION RECEIVED"

    done, snapshots = _wait_for_terminal(client, mission["id"], timeout_sec=480)
    assert done["status"] == "COMPLETED"
    assert done["mode"] == "live"

    # Ensure visible, chronological execution path and all required stages
    event_statuses = [e.get("status") for e in done.get("events", [])]
    expected_stages = [
        "MISSION RECEIVED",
        "PLANNING",
        "SEARCHING",
        "COLLECTING SOURCES",
        "ANALYZING",
        "CROSS-CHECKING",
        "GENERATING OUTPUT",
        "COMPLETED",
    ]
    for stage in expected_stages:
        assert stage in event_statuses

    # Simple chronological check by first appearance index
    indexes = [event_statuses.index(stage) for stage in expected_stages]
    assert indexes == sorted(indexes)

    # Verify multi-pass artifacts and real retrieved source evidence
    artifacts = done.get("artifacts", {})
    assert isinstance(artifacts.get("plan"), dict)
    assert isinstance(artifacts.get("analysis"), str) and len(artifacts["analysis"].strip()) > 20
    assert isinstance(artifacts.get("verification"), str) and len(artifacts["verification"].strip()) > 20

    assert isinstance(done.get("sources"), list)
    assert len(done["sources"]) >= 1
    for src in done["sources"][:5]:
        assert isinstance(src.get("url"), str) and src["url"].startswith("http")
        assert isinstance(src.get("title"), str) and len(src["title"].strip()) > 0

    # Settlement effects must happen once: energy -10, jobs +1, reward reflected in treasury
    after = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()
    assert before["energy"] - after["energy"] == 10
    assert after["jobsCompleted"] == before["jobsCompleted"] + 1
    treasury_delta = (after["treasuryCents"] - before["treasuryCents"]) / 100
    assert round(treasury_delta, 2) == round(float(done.get("rewardAmount", 0)), 2)

    # Ensure no premature terminal popup semantics in API data (must have in-progress snapshots)
    assert any(s.get("status") not in ["COMPLETED", "FAILED"] for s in snapshots)


# tool gating behavior for live execution
def test_live_pipeline_respects_disabled_tools(wallet_session, cleanup_live_data):
    client = wallet_session["client"]

    health = requests.get(f"{BASE_URL}/api/", timeout=30).json()
    if not health.get("liveAI"):
        pytest.skip("Live AI key not configured")

    # Only GitHub enabled (no Public search, no Read websites)
    agent = _create_qa2_agent_with_tools(client, cleanup_live_data, ["GitHub"])

    start = client.post(
        f"{BASE_URL}/api/missions",
        json={
            "agentId": agent["id"],
            "mission": "Find one useful AI agent GitHub repository and summarize with citations.",
            "mode": "live",
        },
        timeout=30,
    )
    assert start.status_code == 202
    mission_id = start.json()["id"]
    cleanup_live_data["mission_ids"].append(mission_id)

    done, _ = _wait_for_terminal(client, mission_id, timeout_sec=480)
    assert done["status"] == "COMPLETED"

    # Read websites disabled: no page-content retrieval should be present
    retrieval_types = [s.get("retrievalType", "") for s in done.get("sources", [])]
    assert all(rt != "page content" for rt in retrieval_types)

    # Public search disabled: no wikipedia provider should appear
    providers = [str(s.get("provider", "")).lower() for s in done.get("sources", [])]
    assert all("wikipedia" not in p for p in providers)
