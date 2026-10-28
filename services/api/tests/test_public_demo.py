import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sentinel import store
from sentinel.main import app, RATE
from sentinel.public_demo import allowed_request, validate_environment

PROVIDER_KEYS = ("BOLNA_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY", "ALLOWED_TEST_NUMBERS", "TOOL_ENDPOINT_TOKEN", "WEBHOOK_SECRET")
TOKEN = "t" * 40
SESSION_A = "a" * 24
SESSION_B = "b" * 24
FROM = {"Origin": "https://voxbento.com"}
SECRET = "gsk_" + "x" * 40


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


def as_session(session, **extra):
    return {**FROM, "X-Sentinel-Session": session, **extra}


@pytest.mark.parametrize("method,path", [
    ("GET", "/api/runs"), ("GET", "/api/runs/abc-1/export"), ("GET", "/api/campaigns"), ("GET", "/api/settings"),
    ("POST", "/api/campaigns"), ("POST", "/api/validate"), ("POST", "/api/runs"), ("POST", "/api/recordings"),
    ("POST", "/api/redteam/attacks"), ("POST", "/api/redteam/harden"), ("POST", "/api/runs/abc/replay"),
    ("POST", "/api/bolna/executions/x/import"), ("PUT", "/api/workflows/audit"), ("DELETE", "/api/runs/abc"),
    ("GET", "/api/bolna/agents"), ("GET", "/api/bolna/executions/x/recording"), ("GET", "/api/agents/x"),
])
def test_allowed(method, path):
    assert allowed_request(method, path)


@pytest.mark.parametrize("method,path", [
    ("POST", "/api/webhooks/bolna"), ("POST", "/api/tools/execute"),
    ("POST", "/api/bolna/agents/x/guardrails"), ("POST", "/api/bolna/deployments/x/rollback"),
    ("GET", "/openapi.json"), ("GET", "/docs"), ("DELETE", "/api/workflows/audit"), ("PUT", "/api/runs/abc"),
    ("GET", "/api/runs/../../etc/passwd"),
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


def test_closed_endpoints_are_refused(public):
    for path in ("/api/tools/execute", "/api/webhooks/bolna", "/api/bolna/agents/x/guardrails", "/api/bolna/deployments/x/rollback"):
        assert public.post(path, json={}, headers=as_session(SESSION_A)).status_code == 403
    assert public.get("/openapi.json").status_code == 403


def test_writes_need_a_session_and_an_allowed_origin(public):
    assert public.post("/api/campaigns", json={"engine": "scripted"}, headers=FROM).status_code == 400
    assert public.post("/api/campaigns", json={"engine": "scripted"}, headers={**as_session(SESSION_A), "Origin": "https://evil.example"}).status_code == 403
    assert public.post("/api/campaigns", json={"engine": "scripted"}, headers=as_session("short")).status_code == 400
    assert public.post("/api/campaigns", json={"engine": "scripted"}, headers=as_session(SESSION_A)).status_code == 201


def test_visitors_are_isolated_but_links_work(public):
    mine = public.post("/api/campaigns", json={"engine": "scripted"}, headers=as_session(SESSION_A)).json()
    assert [c["id"] for c in public.get("/api/campaigns", headers=as_session(SESSION_A)).json()] == [mine["id"]]
    assert public.get("/api/campaigns", headers=as_session(SESSION_B)).json() == []
    assert public.get(f"/api/campaigns/{mine['id']}", headers=as_session(SESSION_B)).status_code == 200
    run_ids = [r["id"] for r in public.get("/api/runs", headers=as_session(SESSION_A)).json()]
    assert run_ids and public.get("/api/runs", headers=as_session(SESSION_B)).json() == []
    assert public.get(f"/api/runs/{run_ids[0]}", headers=as_session(SESSION_B)).status_code == 200


def test_workflow_edits_stay_with_the_visitor(public):
    base = public.get("/api/workflows/adversarial", headers=as_session(SESSION_A)).json()
    saved = public.put("/api/workflows/adversarial", json={**base, "name": "Mine"}, headers=as_session(SESSION_A))
    assert saved.status_code == 200
    assert public.get("/api/workflows/adversarial", headers=as_session(SESSION_A)).json()["name"] == "Mine"
    assert public.get("/api/workflows/adversarial", headers=as_session(SESSION_B)).json()["name"] == base["name"]


def test_keys_are_per_request_and_never_stored(public):
    assert public.get("/api/settings", headers=as_session(SESSION_A)).json()["semantic_configured"] is False
    with_key = public.get("/api/settings", headers=as_session(SESSION_A, **{"X-Groq-Key": SECRET})).json()
    assert with_key["semantic_providers"] == ["groq"] and with_key["byok"] is True
    assert public.get("/api/settings", headers=as_session(SESSION_B)).json()["semantic_configured"] is False
    public.post("/api/campaigns", json={"engine": "scripted"}, headers=as_session(SESSION_A, **{"X-Groq-Key": SECRET, "X-Bolna-Key": "bn-" + "y" * 30}))
    with store.engine.connect() as c:
        stored = " ".join(r[0] for r in c.execute(text("SELECT body FROM documents")).all())
        stored += " ".join(r[0] for r in c.execute(text("SELECT body FROM events")).all())
    assert SECRET not in stored and "bn-yyyy" not in stored


def test_malformed_keys_are_ignored(public):
    for bad in ("short", "has space in it 12345678", "x" * 400):
        assert public.get("/api/settings", headers=as_session(SESSION_A, **{"X-Groq-Key": bad})).json()["semantic_configured"] is False


def test_llm_check_needs_the_visitors_own_key(public):
    r = public.post("/api/campaigns", json={"engine": "llm"}, headers=as_session(SESSION_A))
    assert r.status_code == 422 and "key" in r.json()["detail"].lower()


def test_live_calls_are_refused(public):
    r = public.post("/api/runs", json={"workflow_id": "voice", "version": 1, "mode": "live", "authorized": True, "recipient": "+15555550100", "agent_id": "abc"}, headers=as_session(SESSION_A, **{"X-Bolna-Key": "bn-" + "y" * 30}))
    assert r.status_code == 403
