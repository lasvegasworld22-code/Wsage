"""Targeted regression for tool-health diagnostics and owner-only access semantics."""

import asyncio
import json
import os
import sys
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
    return {"client": api_client, "wallet": data["wallet"]}


@pytest.fixture
def second_wallet_session(api_client):
    r = api_client.post(f"{BASE_URL}/api/session", timeout=30)
    assert r.status_code == 200
    data = r.json()
    client = requests.Session()
    client.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {data['token']}"})
    return {"client": client, "wallet": data["wallet"]}


@pytest.fixture
def cleanup_data():
    # Cleanup for diagnostics documents, sessions and QA-created records only.
    tracker = {"wallet_ids": set(), "agent_ids": [], "tool_health_ids": []}
    yield tracker

    mongo_url = _backend_env_value("MONGO_URL")
    db_name = _backend_env_value("DB_NAME")
    if not mongo_url or not db_name:
        return

    mongo = MongoClient(mongo_url)
    db = mongo[db_name]
    try:
        if tracker["tool_health_ids"]:
            db.tool_health.delete_many({"id": {"$in": tracker["tool_health_ids"]}})
        if tracker["agent_ids"]:
            db.agents.delete_many({"id": {"$in": tracker["agent_ids"]}})
        if tracker["wallet_ids"]:
            ids = list(tracker["wallet_ids"])
            db.sessions.delete_many({"walletId": {"$in": ids}})
            db.wallets.delete_many({"id": {"$in": ids}})
    finally:
        mongo.close()


def _create_agent(client: requests.Session, wallet_id: str, tracker: dict, payload: dict) -> dict:
    response = client.post(f"{BASE_URL}/api/agents", json=payload, timeout=45)
    assert response.status_code == 200
    row = response.json()
    tracker["wallet_ids"].add(wallet_id)
    tracker["agent_ids"].append(row["id"])
    tracker["tool_health_ids"].append(row["id"])
    return row


def _wait_tool_health_complete(client: requests.Session, agent_id: str, timeout_sec: int = 80) -> dict:
    start = time.time()
    while time.time() - start < timeout_sec:
        row = client.get(f"{BASE_URL}/api/agents/{agent_id}/tools/health", timeout=30)
        assert row.status_code == 200
        body = row.json()
        if body["status"] == "COMPLETE":
            return body
        time.sleep(1)
    pytest.fail(f"Tool health for {agent_id} did not reach COMPLETE in {timeout_sec}s")


# API diagnostics lifecycle and owner-only authorization behavior
def test_tool_health_initial_state_and_owner_guards(wallet_session, second_wallet_session, cleanup_data):
    agent = _create_agent(
        wallet_session["client"],
        wallet_session["wallet"]["id"],
        cleanup_data,
        {
            "name": "TH_Initial",
            "avatar": "mint",
            "category": "Analyst",
            "customTools": [{"name": "CPython", "url": "https://api.github.com/repos/python/cpython", "method": "GET", "format": "json", "headers": {}, "body": {}}],
        },
    )
    cleanup_data["wallet_ids"].add(second_wallet_session["wallet"]["id"])

    public_call = requests.get(f"{BASE_URL}/api/agents/{agent['id']}/tools/health", timeout=30)
    assert public_call.status_code == 401

    owner_state = wallet_session["client"].get(f"{BASE_URL}/api/agents/{agent['id']}/tools/health", timeout=30)
    assert owner_state.status_code == 200
    body = owner_state.json()
    assert body["status"] == "UNCHECKED"
    assert body["checks"] == []
    assert body["checkedAt"] is None

    forbidden_get = second_wallet_session["client"].get(f"{BASE_URL}/api/agents/{agent['id']}/tools/health", timeout=30)
    assert forbidden_get.status_code == 403
    forbidden_post = second_wallet_session["client"].post(f"{BASE_URL}/api/agents/{agent['id']}/tools/check", timeout=30)
    assert forbidden_post.status_code == 403


# API diagnostics statuses and no mission/energy/tool-actions side effects
def test_tool_health_statuses_and_no_side_effects(wallet_session, cleanup_data):
    client = wallet_session["client"]
    agent = _create_agent(
        client,
        wallet_session["wallet"]["id"],
        cleanup_data,
        {
            "name": "TH_Statuses",
            "avatar": "blue",
            "category": "Builder",
            "customTools": [
                {"name": "GoodJSON", "url": "https://api.github.com/repos/python/cpython", "method": "GET", "format": "json", "headers": {}, "body": {}},
                {"name": "BadJSON", "url": "https://example.com", "method": "GET", "format": "json", "headers": {}, "body": {}},
                {"name": "Unreachable", "url": "https://nonexistent-agentws-health.invalid", "method": "GET", "format": "json", "headers": {}, "body": {}},
                {"name": "Poster", "url": "https://httpbingo.org/post", "method": "POST", "format": "json", "headers": {"Authorization": "Bearer NEVER_SEND"}, "body": {"hello": "world"}},
            ],
        },
    )

    before_agent = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()
    before_missions = client.get(f"{BASE_URL}/api/missions", timeout=30).json()
    before_actions = client.get(f"{BASE_URL}/api/agents/{agent['id']}/tool-actions", timeout=30).json()

    start = client.post(f"{BASE_URL}/api/agents/{agent['id']}/tools/check", timeout=30)
    assert start.status_code == 202
    assert start.json()["status"] in ["CHECKING", "COMPLETE"]

    complete = _wait_tool_health_complete(client, agent["id"])
    checks = {item["name"]: item for item in complete["checks"]}

    assert checks["GoodJSON"]["status"] == "READY"
    assert checks["BadJSON"]["status"] == "ERROR"
    assert "not valid json" in checks["BadJSON"]["message"].lower()
    assert checks["Unreachable"]["status"] == "ERROR"
    assert checks["Poster"]["status"] == "LIMITED"
    assert "post was not sent" in checks["Poster"]["message"].lower()

    after_agent = requests.get(f"{BASE_URL}/api/agents/{agent['id']}", timeout=30).json()
    after_missions = client.get(f"{BASE_URL}/api/missions", timeout=30).json()
    after_actions = client.get(f"{BASE_URL}/api/agents/{agent['id']}/tool-actions", timeout=30).json()

    assert after_agent["jobsCompleted"] == before_agent["jobsCompleted"]
    assert after_agent["energy"] == before_agent["energy"]
    assert len(after_missions) == len(before_missions)
    assert len(after_actions) == len(before_actions)


# Secret headers redaction, no leakage, and fingerprint invalidation behavior
def test_tool_health_no_secret_leak_and_config_change_marks_unchecked(wallet_session, cleanup_data):
    client = wallet_session["client"]
    secret = "Bearer SUPER_SECRET_TOOL_TOKEN"
    agent = _create_agent(
        client,
        wallet_session["wallet"]["id"],
        cleanup_data,
        {
            "name": "TH_Secrets",
            "avatar": "gold",
            "category": "Analyst",
            "customTools": [
                {
                    "name": "SecureSource",
                    "url": "https://api.github.com/repos/python/cpython",
                    "method": "GET",
                    "format": "json",
                    "headers": {"Authorization": secret},
                    "body": {},
                }
            ],
        },
    )

    trigger = client.post(f"{BASE_URL}/api/agents/{agent['id']}/tools/check", timeout=30)
    assert trigger.status_code == 202
    final = _wait_tool_health_complete(client, agent["id"])
    serialized = json.dumps(final)
    assert secret not in serialized
    assert "SUPER_SECRET_TOOL_TOKEN" not in serialized

    world = requests.get(f"{BASE_URL}/api/world", timeout=30)
    assert world.status_code == 200
    target = next(a for a in world.json()["agents"] if a["id"] == agent["id"])
    assert "customTools" not in target

    listing = requests.get(f"{BASE_URL}/api/agents", timeout=30)
    assert listing.status_code == 200
    row = next(a for a in listing.json() if a["id"] == agent["id"])
    assert "customTools" not in row

    settings = client.get(f"{BASE_URL}/api/agents/{agent['id']}/settings", timeout=30)
    assert settings.status_code == 200
    tool = settings.json()["customTools"][0]
    assert "headers" not in tool
    assert "secretHeaders" not in tool

    updated = settings.json()
    updated["dataSources"] = (updated.get("dataSources") or "") + " https://api.github.com/repos/psf/requests"
    patch = client.patch(f"{BASE_URL}/api/agents/{agent['id']}/mind", json=updated, timeout=30)
    assert patch.status_code == 200

    state = client.get(f"{BASE_URL}/api/agents/{agent['id']}/tools/health", timeout=30)
    assert state.status_code == 200
    assert state.json()["status"] == "UNCHECKED"


# Unit guard: POST target health check must not route through read_source.
def test_post_health_check_never_calls_read_source(monkeypatch):
    if "/app/backend" not in sys.path:
        sys.path.insert(0, "/app/backend")
    from tool_health import inspect_target

    called = {"read_source": False, "probe": False}

    async def fail_if_read_source(*args, **kwargs):
        called["read_source"] = True
        raise AssertionError("read_source must not run for POST diagnostics")

    async def fake_probe(_url):
        called["probe"] = True
        return None

    monkeypatch.setattr("tool_health.read_source", fail_if_read_source)
    monkeypatch.setattr("tool_health.probe_connection", fake_probe)

    row = asyncio.run(
        inspect_target(
            {
                "id": "post-only",
                "name": "Poster",
                "url": "https://httpbingo.org/post",
                "method": "POST",
                "sourceType": "custom",
            },
            {"tools": []},
            asyncio.Semaphore(1),
        )
    )

    assert called["probe"] is True
    assert called["read_source"] is False
    assert row["status"] == "LIMITED"
    assert "post was not sent" in row["message"].lower()
