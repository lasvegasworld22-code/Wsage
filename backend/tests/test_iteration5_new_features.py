"""Focused regression tests for category presets, model/tool validation, custom tools, and action approvals."""

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
    api_client.headers.update({"Authorization": f"Bearer {data['token']}"})
    return {"client": api_client, "wallet": data["wallet"], "token": data["token"]}


@pytest.fixture
def second_wallet_session(api_client):
    r = api_client.post(f"{BASE_URL}/api/session", timeout=30)
    assert r.status_code == 200
    data = r.json()
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {data['token']}"})
    return {"client": session, "wallet": data["wallet"], "token": data["token"]}


@pytest.fixture
def cleanup_data():
    tracker = {"wallet_ids": set(), "agent_ids": [], "action_ids": [], "mission_ids": []}
    yield tracker

    mongo_url = _backend_env_value("MONGO_URL")
    db_name = _backend_env_value("DB_NAME")
    if not mongo_url or not db_name:
        return

    mongo = MongoClient(mongo_url)
    db = mongo[db_name]
    try:
        if tracker["mission_ids"]:
            deadline = time.time() + 420
            while time.time() < deadline:
                running = db.missions.count_documents(
                    {"id": {"$in": tracker["mission_ids"]}, "status": {"$nin": ["COMPLETED", "FAILED"]}}
                )
                if running == 0:
                    break
                time.sleep(1)

        if tracker["action_ids"]:
            db.tool_actions.delete_many({"id": {"$in": tracker["action_ids"]}})
        if tracker["mission_ids"]:
            pool = db.pool.find_one({"id": "main"}) or {}
            for reward in pool.get("rewards", []):
                if reward.get("missionId") in tracker["mission_ids"]:
                    db.pool.update_one(
                        {"id": "main", "rewards.missionId": reward["missionId"]},
                        {"$pull": {"rewards": {"missionId": reward["missionId"]}},
                         "$inc": {"balanceCents": reward.get("amountCents", 0)}})
            db.missions.delete_many({"id": {"$in": tracker["mission_ids"]}})
        if tracker["agent_ids"]:
            db.agents.delete_many({"id": {"$in": tracker["agent_ids"]}})
        if tracker["wallet_ids"]:
            ids = list(tracker["wallet_ids"])
            db.sessions.delete_many({"walletId": {"$in": ids}})
            db.wallets.delete_many({"id": {"$in": ids}})
    finally:
        mongo.close()


def _create_agent(client: requests.Session, wallet_id: str, tracker: dict, payload: dict) -> dict:
    res = client.post(f"{BASE_URL}/api/agents", json=payload, timeout=45)
    assert res.status_code == 200
    agent = res.json()
    tracker["wallet_ids"].add(wallet_id)
    tracker["agent_ids"].append(agent["id"])
    return agent


def test_catalog_presets_are_distinct_and_models_locked_except_gpt54(api_client):
    res = api_client.get(f"{BASE_URL}/api/catalog", timeout=30)
    assert res.status_code == 200
    data = res.json()

    categories = data["categories"]
    assert len(categories) == 6
    assert set(categories.keys()) == {"Research", "Analyst", "Scout", "Content", "Builder", "Social Intelligence"}

    tool_sets = {name: tuple(value["tools"]) for name, value in categories.items()}
    assert len(set(tool_sets.values())) == 6
    assert categories["Analyst"]["outputFormat"] == "Data analysis"
    assert categories["Builder"]["outputFormat"] == "Technical plan"
    assert categories["Social Intelligence"]["outputFormat"] == "Sentiment brief"

    models = data["models"]
    enabled = [m["name"] for m in models if m.get("enabled")]
    disabled = [m["name"] for m in models if not m.get("enabled")]
    assert len(models) == 9
    assert enabled == ["OpenAI GPT-5.4"]
    assert len(disabled) == 8
    assert any("Claude" in name for name in disabled)


def test_agent_create_applies_category_defaults_direct_api(wallet_session, cleanup_data):
    payload = {
        "name": "Iter5Analyst",
        "avatar": "blue",
        "category": "Analyst",
    }
    agent = _create_agent(wallet_session["client"], wallet_session["wallet"]["id"], cleanup_data, payload)

    assert agent["category"] == "Analyst"
    assert agent["brainConfig"] == "OpenAI GPT-5.4"
    assert agent["tools"] == ["JSON data", "CSV data", "Statistics", "Compare sources"]
    assert agent["outputFormat"] == "Data analysis"
    assert "dataset" in agent["dataSources"].lower()


def test_disallowed_model_returns_422(wallet_session):
    payload = {
        "name": "Iter5BadModel",
        "avatar": "mint",
        "category": "Research",
        "brainConfig": "Claude Sonnet 4.6",
    }
    res = wallet_session["client"].post(f"{BASE_URL}/api/agents", json=payload, timeout=30)
    assert res.status_code == 422


def test_unknown_tool_returns_422(wallet_session):
    payload = {
        "name": "Iter5BadTool",
        "avatar": "mint",
        "category": "Research",
        "tools": ["Public search", "Unknown Tool X"],
    }
    res = wallet_session["client"].post(f"{BASE_URL}/api/agents", json=payload, timeout=30)
    assert res.status_code == 422


def test_custom_tool_validation_and_private_header_hiding(wallet_session, cleanup_data):
    payload = {
        "name": "Iter5Custom",
        "avatar": "gold",
        "category": "Analyst",
        "customTools": [
            {
                "name": "CPython JSON",
                "url": "https://api.github.com/repos/python/cpython",
                "method": "GET",
                "format": "json",
                "headers": {"Authorization": "Bearer TOP_SECRET"},
                "body": {},
            }
        ],
    }
    agent = _create_agent(wallet_session["client"], wallet_session["wallet"]["id"], cleanup_data, payload)

    settings = wallet_session["client"].get(f"{BASE_URL}/api/agents/{agent['id']}/settings", timeout=30)
    assert settings.status_code == 200
    body = settings.json()
    assert isinstance(body["customTools"], list) and len(body["customTools"]) == 1
    tool = body["customTools"][0]
    assert "secretHeaders" not in tool
    assert "headers" not in tool
    assert tool["headerNames"] == ["Authorization"]

    bad = wallet_session["client"].post(
        f"{BASE_URL}/api/agents",
        json={
            "name": "Iter5PrivateUrl",
            "avatar": "mint",
            "category": "Research",
            "customTools": [
                {
                    "name": "Blocked Local",
                    "url": "http://localhost:8001/",
                    "method": "GET",
                    "format": "website",
                    "headers": {},
                    "body": {},
                }
            ],
        },
        timeout=30,
    )
    assert bad.status_code == 422


def test_post_action_approval_workflow_and_single_send(wallet_session, cleanup_data):
    payload = {
        "name": "Iter5Action",
        "avatar": "violet",
        "category": "Builder",
        "customTools": [
            {
                "name": "Echo Post",
                "url": "https://httpbingo.org/post",
                "method": "POST",
                "format": "json",
                "headers": {"Authorization": "Bearer VERY_PRIVATE_TOKEN"},
                "body": {"hello": "world"},
            }
        ],
    }
    agent = _create_agent(wallet_session["client"], wallet_session["wallet"]["id"], cleanup_data, payload)

    settings = wallet_session["client"].get(f"{BASE_URL}/api/agents/{agent['id']}/settings", timeout=30)
    assert settings.status_code == 200
    post_tool = next(t for t in settings.json()["customTools"] if t["method"] == "POST")

    preview = wallet_session["client"].post(
        f"{BASE_URL}/api/agents/{agent['id']}/tool-actions",
        json={"toolId": post_tool["id"], "body": {"approve": False, "id": "first"}},
        timeout=30,
    )
    assert preview.status_code == 201
    first_action = preview.json()
    cleanup_data["action_ids"].append(first_action["id"])
    assert first_action["status"] == "PENDING"
    assert "result" not in first_action

    rejected = wallet_session["client"].post(f"{BASE_URL}/api/tool-actions/{first_action['id']}/reject", timeout=30)
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "REJECTED"

    preview_two = wallet_session["client"].post(
        f"{BASE_URL}/api/agents/{agent['id']}/tool-actions",
        json={"toolId": post_tool["id"], "body": {"approve": True, "id": "second"}},
        timeout=30,
    )
    assert preview_two.status_code == 201
    second_action = preview_two.json()
    cleanup_data["action_ids"].append(second_action["id"])

    approved = wallet_session["client"].post(
        f"{BASE_URL}/api/tool-actions/{second_action['id']}/approve",
        json={"confirmed": True},
        timeout=30,
    )
    assert approved.status_code == 202
    assert approved.json()["status"] == "RUNNING"

    repeated = wallet_session["client"].post(
        f"{BASE_URL}/api/tool-actions/{second_action['id']}/approve",
        json={"confirmed": True},
        timeout=30,
    )
    assert repeated.status_code == 409

    final = None
    for _ in range(16):
        history = wallet_session["client"].get(f"{BASE_URL}/api/agents/{agent['id']}/tool-actions", timeout=30)
        assert history.status_code == 200
        rows = history.json()
        match = next((row for row in rows if row["id"] == second_action["id"]), None)
        if match and match["status"] in ["SUCCEEDED", "FAILED_OR_UNKNOWN"]:
            final = match
            break
        time.sleep(1)

    assert final is not None
    if final["status"] == "SUCCEEDED":
        assert "VERY_PRIVATE_TOKEN" not in final.get("result", "")


def test_public_endpoints_hide_private_tools_and_settings_owner_only(wallet_session, second_wallet_session, cleanup_data):
    payload = {
        "name": "Iter5LeakGuard",
        "avatar": "mint",
        "category": "Research",
        "customTools": [
            {
                "name": "Private API",
                "url": "https://api.github.com/repos/python/cpython",
                "method": "GET",
                "format": "json",
                "headers": {"Authorization": "Bearer SHOULD_NOT_LEAK"},
                "body": {},
            }
        ],
    }
    agent = _create_agent(wallet_session["client"], wallet_session["wallet"]["id"], cleanup_data, payload)
    cleanup_data["wallet_ids"].add(second_wallet_session["wallet"]["id"])

    world = requests.get(f"{BASE_URL}/api/world", timeout=30)
    assert world.status_code == 200
    target = next(a for a in world.json()["agents"] if a["id"] == agent["id"])
    assert "customTools" not in target

    rows = requests.get(f"{BASE_URL}/api/agents", timeout=30)
    assert rows.status_code == 200
    row = next(a for a in rows.json() if a["id"] == agent["id"])
    assert "customTools" not in row

    forbidden = second_wallet_session["client"].get(f"{BASE_URL}/api/agents/{agent['id']}/settings", timeout=30)
    assert forbidden.status_code == 403


def test_post_tools_are_not_executed_during_research(wallet_session, cleanup_data):
    payload = {
        "name": "Iter5NoPostInResearch",
        "researchDepth": "quick",
        "avatar": "mint",
        "category": "Builder",
        "customTools": [
            {
                "name": "ShouldApproveSeparately",
                "url": "https://httpbingo.org/post",
                "method": "POST",
                "format": "json",
                "headers": {},
                "body": {"k": "v"},
            }
        ],
    }
    agent = _create_agent(wallet_session["client"], wallet_session["wallet"]["id"], cleanup_data, payload)

    before = wallet_session["client"].get(f"{BASE_URL}/api/agents/{agent['id']}/tool-actions", timeout=30)
    assert before.status_code == 200
    assert before.json() == []

    start = wallet_session["client"].post(
        f"{BASE_URL}/api/missions",
        json={
            "agentId": agent["id"],
            "mission": "Inspect Python repository documentation and provide a short technical plan.",
            "mode": "demo",
        },
        timeout=30,
    )
    assert start.status_code == 202
    mid = start.json()["id"]
    cleanup_data["mission_ids"].append(mid)

    done = None
    deadline = time.time() + 180
    while time.time() < deadline:
        row = wallet_session["client"].get(f"{BASE_URL}/api/missions/{mid}", timeout=30)
        assert row.status_code == 200
        data = row.json()
        if data["status"] in ["COMPLETED", "FAILED"]:
            done = data
            break
        time.sleep(1)

    assert done is not None
    after = wallet_session["client"].get(f"{BASE_URL}/api/agents/{agent['id']}/tool-actions", timeout=30)
    assert after.status_code == 200
    assert after.json() == []


def test_live_analyst_json_stats_pipeline(wallet_session, cleanup_data):
    health = requests.get(f"{BASE_URL}/api/", timeout=30)
    assert health.status_code == 200
    if not health.json().get("liveAI"):
        pytest.skip("Live AI key not configured")

    payload = {
        "name": "Iter5LiveAnalyst",
        "researchDepth": "quick",
        "avatar": "coral",
        "category": "Analyst",
        "tools": ["JSON data", "Statistics", "Compare sources"],
        "customTools": [
            {
                "name": "CPython Repo API",
                "url": "https://api.github.com/repos/python/cpython",
                "method": "GET",
                "format": "json",
                "headers": {},
                "body": {},
            }
        ],
    }
    agent = _create_agent(wallet_session["client"], wallet_session["wallet"]["id"], cleanup_data, payload)

    launch = wallet_session["client"].post(
        f"{BASE_URL}/api/missions",
        json={
            "agentId": agent["id"],
            "mission": "Analyze the CPython repository JSON metadata source and provide concise numeric statistics-backed findings with citations.",
            "mode": "live",
        },
        timeout=30,
    )
    assert launch.status_code == 202
    mission = launch.json()
    cleanup_data["mission_ids"].append(mission["id"])

    done = None
    start = time.time()
    while time.time() - start < 360:
        row = wallet_session["client"].get(f"{BASE_URL}/api/missions/{mission['id']}", timeout=30)
        assert row.status_code == 200
        data = row.json()
        if data["status"] in ["COMPLETED", "FAILED"]:
            done = data
            break
        time.sleep(2)

    assert done is not None
    assert done["status"] == "COMPLETED"
    assert isinstance(done.get("artifacts", {}).get("plan"), dict)
    assert isinstance(done.get("artifacts", {}).get("analysis"), str) and done["artifacts"]["analysis"].strip()
    assert isinstance(done.get("artifacts", {}).get("verification"), str) and done["artifacts"]["verification"].strip()
    assert isinstance(done.get("sources"), list) and len(done["sources"]) >= 1

    with_stats = [s for s in done["sources"] if isinstance(s.get("metadata"), dict) and "statistics" in s.get("metadata", {})]
    assert len(with_stats) >= 1
