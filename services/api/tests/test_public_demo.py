import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sentinel import store
from sentinel.main import app, RATE
from sentinel.public_demo import allowed_request, validate_environment

PROVIDER_KEYS = ("BOLNA_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY", "ALLOWED_TEST_NUMBERS", "TOOL_ENDPOINT_TOKEN", "WEBHOOK_SECRET")
TOKEN = "t" * 40


@pytest.fixture
def public(tmp_path, monkeypatch):
    data = tmp_path / "public-demo"
    data.mkdir()
    engine = create_engine(f"sqlite:///{data}/test.db", connect_args={"check_same_thread": False})
    monkeypatch.setattr(store, "engine", engine)
    monkeypatch.setattr(store, "DATA", data)
    for key in PROVIDER_KEYS + ("DATABASE_URL", "RENDER"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("SENTINEL_PUBLIC_DEMO", "true")
    monkeypatch.setenv("SENTINEL_DATA_DIR", str(data))
    monkeypatch.setenv("SENTINEL_API_TOKEN", TOKEN)
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://voxbento.com")
    RATE.clear()
    with TestClient(app, headers={"X-Sentinel-Token": TOKEN}) as c:
        yield c
    engine.dispose()


@pytest.mark.parametrize("method,path", [
    ("GET", "/api/runs"), ("GET", "/api/runs/abc-1/export"), ("GET", "/api/campaigns"),
    ("GET", "/api/settings"), ("POST", "/api/campaigns"), ("POST", "/api/validate"),
])
def test_allowed(method, path):
    assert allowed_request(method, path)


@pytest.mark.parametrize("method,path", [
    ("POST", "/api/runs"), ("POST", "/api/recordings"), ("POST", "/api/webhooks/bolna"),
    ("POST", "/api/tools/execute"), ("POST", "/api/redteam/harden"), ("POST", "/api/redteam/attacks"),
    ("POST", "/api/bolna/agents/x/guardrails"), ("POST", "/api/bolna/executions/x/import"),
    ("PUT", "/api/workflows/audit"), ("DELETE", "/api/runs/abc"), ("POST", "/api/runs/abc/replay"),
    ("GET", "/api/bolna/agents"), ("GET", "/api/bolna/executions/x/recording"), ("GET", "/api/agents/x"),
])
def test_blocked(method, path):
    assert not allowed_request(method, path)


def test_startup_refuses_provider_keys_and_shared_data(monkeypatch, tmp_path):
    monkeypatch.setenv("SENTINEL_PUBLIC_DEMO", "true")
    monkeypatch.setenv("SENTINEL_API_TOKEN", TOKEN)
    monkeypatch.setenv("SENTINEL_DATA_DIR", str(tmp_path / "public-demo"))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    for key in PROVIDER_KEYS:
        monkeypatch.delenv(key, raising=False)
    validate_environment()
    for key in PROVIDER_KEYS:
        monkeypatch.setenv(key, "x")
        with pytest.raises(RuntimeError):
            validate_environment()
        monkeypatch.delenv(key)
    monkeypatch.setenv("SENTINEL_DATA_DIR", str(tmp_path / "private"))
    with pytest.raises(RuntimeError):
        validate_environment()


def test_public_release_check_runs_but_live_actions_do_not(public):
    assert public.get("/api/demo-config").json()["public_demo"] is True
    assert public.get("/api/settings").json()["public_demo"] is True
    for path, body in [("/api/runs", {}), ("/api/recordings", {}), ("/api/redteam/attacks", {}), ("/api/tools/execute", {})]:
        r = public.post(path, json=body, headers={"Origin": "https://voxbento.com"})
        assert r.status_code == 403 and "Public rehearsal" in r.json()["detail"]
    assert public.put("/api/workflows/audit", json={}).status_code == 403
    for body in ({"engine": "llm"}, {"engine": "scripted", "agent_id": "abc"}, {"engine": "scripted", "patch": "x" * 40}):
        assert public.post("/api/campaigns", json=body, headers={"Origin": "https://voxbento.com"}).status_code == 403
    assert public.post("/api/campaigns", json={"engine": "scripted"}, headers={"Origin": "https://evil.example"}).status_code == 403
    ok = public.post("/api/campaigns", json={"engine": "scripted"}, headers={"Origin": "https://voxbento.com"})
    assert ok.status_code == 201


def test_public_release_check_cap(public, monkeypatch):
    monkeypatch.setattr(store, "all_docs", lambda kind: [{"status": "completed"}] * 100 if kind == "campaign" else [])
    r = public.post("/api/campaigns", json={"engine": "scripted"}, headers={"Origin": "https://voxbento.com"})
    assert r.status_code == 429
