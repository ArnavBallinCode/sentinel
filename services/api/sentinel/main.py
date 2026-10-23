import asyncio, os, json, time, uuid, hmac, hashlib, re
from contextlib import asynccontextmanager
from typing import Literal
from pydantic import BaseModel, Field
from collections import defaultdict, deque
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Header
from fastapi.responses import StreamingResponse, FileResponse, Response
import httpx
from . import store
from .models import Graph, RunRequest, ToolRequest
from .registry import REGISTRY, validate, template
from .governance import controlled_tool, redact, SCENARIOS
from .bolna import BolnaAdapter, ProviderError, normalize_execution
from .providers import configured_providers, transcription_provider
from .executor import launch, TASKS, TERMINAL, refresh
from . import redteam


@asynccontextmanager
async def lifespan(app):
    store.init_db()
    for kind in ("adversarial", "voice", "audit"):
        if not store.get("workflow", kind):
            graph = template(kind)
            store.insert("version", f"{kind}:1", graph)
            store.put("workflow", kind, graph)
    for run in store.all_docs("run"):
        if run["status"] == "running":
            run["status"] = "interrupted"
            for record in run["nodes"].values():
                if record["status"] == "running":
                    record["status"] = "blocked"
                    record["error"] = (
                        "Server restarted. External calls will not be replayed automatically."
                    )
            store.put("run", run["id"], run)
    yield
    for task in list(TASKS.values()):
        task.cancel()
    await asyncio.gather(*list(TASKS.values()), return_exceptions=True)


app = FastAPI(title="Sentinel Workflow API", version="0.1.0", lifespan=lifespan)
RATE = defaultdict(deque)


@app.middleware("http")
async def security(request, call_next):
    from fastapi.responses import JSONResponse

    token = os.getenv("SENTINEL_API_TOKEN")
    if (
        token
        and request.url.path != "/api/health"
        and not hmac.compare_digest(request.headers.get("X-Sentinel-Token", ""), token)
    ):
        return JSONResponse({"detail": "Unauthorized"}, 401)
    if request.method in ("POST", "PUT", "DELETE"):
        origin = request.headers.get("origin")
        if origin and origin not in os.getenv(
            "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(","):
            return JSONResponse({"detail": "Origin rejected"}, 403)
        key = request.client.host if request.client else "local"
        bucket = RATE[key]
        now = time.time()
        while bucket and bucket[0] < now - 60:
            bucket.popleft()
        if len(bucket) >= 90:
            return JSONResponse({"detail": "Rate limit reached; wait one minute"}, 429)
        bucket.append(now)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def require(kind, id):
    item = store.get(kind, id)
    if not item:
        raise HTTPException(404, f"{kind} not found")
    return item


@app.exception_handler(ProviderError)
async def provider_error(request, exc):
    from fastapi.responses import JSONResponse

    return JSONResponse({"detail": str(exc)}, 502)


@app.get("/api/health")
def health():
    return {"status": "ok", "application": "Sentinel"}


@app.get("/api/registry")
def registry():
    return {k: {"type": k, **v} for k, v in REGISTRY.items()}


@app.get("/api/settings")
def settings():
    return {
        "bolna_configured": bool(os.getenv("BOLNA_API_KEY")),
        "semantic_configured": bool(configured_providers()),
        "semantic_providers": configured_providers(),
        "allowed_numbers_count": len(
            [x for x in os.getenv("ALLOWED_TEST_NUMBERS", "").split(",") if x]
        ),
        "deployment": "single-user local workspace",
        "limitations": [
            "Live calls require an opted-in allowlisted number.",
            "Hosted utterance interception is unsupported.",
            "No autonomous bidirectional voice caller is connected.",
            "Recording transcription uses an optional external provider.",
        ],
    }


@app.get("/api/bolna/agents")
async def bolna_agents():
    raw = await BolnaAdapter().request("GET", "/v2/agent/all")
    agents = raw if isinstance(raw, list) else raw.get("agents", raw.get("data", []))
    if not isinstance(agents, list):
        agents = []
    return {
        "agents": [
            {
                "id": str(agent.get("id") or agent.get("agent_id") or ""),
                "name": str(agent.get("name") or agent.get("agent_name") or "Unnamed agent"),
                "status": agent.get("status"),
            }
            for agent in agents
            if isinstance(agent, dict) and (agent.get("id") or agent.get("agent_id"))
        ]
    }


@app.get("/api/scenarios")
def scenarios():
    return SCENARIOS


@app.get("/api/workflows")
def workflows():
    return store.all_docs("workflow")


@app.get("/api/workflows/{id}")
def workflow(id: str):
    return require("workflow", id)


@app.post("/api/validate")
def validation(graph: Graph):
    return validate(graph)


@app.put("/api/workflows/{id}")
def save(id: str, graph: Graph):
    check = validate(graph)
    if not check["valid"]:
        raise HTTPException(422, check["errors"])
    old = store.get("workflow", id)
    if old and graph.version != old["version"]:
        raise HTTPException(409, "This workflow changed. Reload before saving.")
    version = old["version"] + 1 if old else 1
    result = {**graph.model_dump(), "id": id, "version": version, "published": False}
    try:
        store.insert("version", f"{id}:{version}", result)
    except Exception:
        raise HTTPException(409, "Concurrent save. Reload and try again.") from None
    store.put("workflow", id, result)
    return result


@app.get("/api/workflows/{id}/versions")
def versions(id: str):
    require("workflow", id)
    return sorted(
        [g for g in store.all_docs("version") if g["id"] == id],
        key=lambda x: x["version"],
        reverse=True,
    )


@app.post("/api/workflows/{id}/publish")
def publish(id: str):
    graph = require("workflow", id)
    result = validate(Graph(**graph))
    if not result["valid"]:
        raise HTTPException(422, result["errors"])
    graph["published"] = True
    store.put("workflow", id, graph)
    return {
        "version": graph["version"],
        "published": True,
        "note": "Published locally; no external deployment or incoming-call trigger enabled.",
    }


@app.post("/api/runs", status_code=201)
async def start(req: RunRequest):
    graph = require("version", f"{req.workflow_id}:{req.version}")
    check = validate(Graph(**graph), req.mode)
    if not check["valid"]:
        raise HTTPException(422, check["errors"])
    active = [r for r in store.all_docs("run") if r["status"] in ("running", "waiting")]
    if len(active) >= 5:
        raise HTTPException(429, "At most five active runs are supported.")
    if req.mode == "live":
        if sum(n["type"] == "bolna" for n in graph["nodes"]) != 1:
            raise HTTPException(422, "Live workflows require exactly one Bolna node.")
        if (
            not req.authorized
            or req.recipient not in os.getenv("ALLOWED_TEST_NUMBERS", "").split(",")
            or not req.recipient
        ):
            raise HTTPException(
                403,
                "An explicitly opted-in, server-allowlisted test number is required.",
            )
        if not os.getenv("BOLNA_API_KEY"):
            raise HTTPException(422, "BOLNA_API_KEY is not configured.")
        if not req.agent_id:
            raise HTTPException(422, "Connect a Bolna agent first.")
        today = [
            r
            for r in store.all_docs("run")
            if r["mode"] == "live" and r["created_at"] > time.time() - 86400
        ]
        if len(today) >= int(os.getenv("MAX_LIVE_CALLS_PER_DAY", "5")):
            raise HTTPException(429, "Daily live call limit reached.")
    if req.mode == "audit":
        require("recording", req.recording_id or "")
    id = str(uuid.uuid4())
    request = redact(req.model_dump())
    if req.mode == "live":
        store.insert("dispatch", id, {"recipient": req.recipient})
    run = {
        "id": id,
        "workflow_id": req.workflow_id,
        "version": req.version,
        "graph": graph,
        "mode": req.mode,
        "request": request,
        "status": "running",
        "created_at": time.time(),
        "nodes": {},
        "fingerprint": hashlib.sha256(
            json.dumps(graph, sort_keys=True).encode()
        ).hexdigest(),
    }
    store.insert("run", id, run)
    store.event(id, {"event": "run_started", "status": "running", "mode": req.mode})
    launch(id)
    return run


@app.get("/api/runs")
def runs():
    return [
        {
            **{k: v for k, v in r.items() if k not in ("nodes", "graph")},
            "name": r.get("graph", {}).get("name", r["workflow_id"]),
            "finding_count": len({
                f["id"] for n in r.get("nodes", {}).values()
                for f in (n.get("output") or {}).get("findings", [])
            }),
        }
        for r in store.all_docs("run")
    ]


@app.get("/api/runs/{id}")
def run(id: str):
    return require("run", id)


@app.post("/api/runs/{id}/cancel")
async def cancel(id: str):
    run = require("run", id)
    if run["status"] in TERMINAL:
        return run
    if run["status"] == "waiting":
        raise HTTPException(
            409,
            "A hosted call is in progress. Cancel it in Bolna; Sentinel cannot guarantee provider cancellation.",
        )
    run["status"] = "cancelled"
    store.put("run", id, run)
    if id in TASKS:
        TASKS[id].cancel()
    return run


@app.post("/api/runs/{id}/refresh")
async def refresh_run(id: str):
    require("run", id)
    try:
        return await refresh(id)
    except ValueError as e:
        raise HTTPException(409, str(e))


@app.get("/api/runs/{id}/events")
async def stream(id: str, request: Request, after: int = 0):
    require("run", id)
    try:
        cursor = max(after, int(request.headers.get("last-event-id", "0")))
    except ValueError:
        cursor = after

    async def generate():
        nonlocal cursor
        while not await request.is_disconnected():
            for event in store.events(id, cursor):
                cursor = event["seq"]
                yield f"id: {cursor}\ndata: {json.dumps(event)}\n\n"
            r = store.get("run", id)
            if not r or r["status"] in TERMINAL:
                break
            yield ": heartbeat\n\n"
            await asyncio.sleep(0.4)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/runs/{id}/export")
def export(id: str):
    return require("run", id)


@app.post("/api/runs/{id}/reviews")
async def review(id: str, request: Request):
    run = require("run", id)
    body = await request.json()
    findings = {
        f["id"]
        for n in run["nodes"].values()
        for f in n.get("output", {}).get("findings", [])
    }
    if body.get("finding_id") not in findings or body.get("status") not in (
        "confirmed",
        "dismissed",
        "needs_review",
    ):
        raise HTTPException(422, "Invalid finding or review status")
    result = {
        "id": str(uuid.uuid4()),
        "run_id": id,
        "finding_id": body["finding_id"],
        "status": body["status"],
        "created_at": time.time(),
    }
    store.insert("review", result["id"], result)
    return result


@app.get("/api/runs/{id}/reviews")
def reviews(id: str):
    require("run", id)
    return [r for r in store.all_docs("review") if r["run_id"] == id]


@app.get("/api/compare")
def compare(before: str, after: str):
    a = require("run", before)
    b = require("run", after)

    def metrics(r):
        fs = {
            f["id"]: f
            for n in r["nodes"].values()
            for f in n.get("output", {}).get("findings", [])
        }
        unsupported = list(
            {
                x
                for n in r["nodes"].values()
                for x in n.get("output", {}).get("unsupported", [])
            }
        )
        evaluated = any("evaluated" in n.get("output", {}) for n in r["nodes"].values())
        return {
            "findings": list(fs.values()),
            "unsupported": unsupported,
            "evaluated": evaluated,
            "passed": r["status"] == "completed"
            and evaluated
            and not fs
            and not unsupported,
            "duration_ms": round(
                (r.get("ended_at", r["created_at"]) - r["created_at"]) * 1000
            ),
            "cost": None,
        }

    am, bm = metrics(a), metrics(b)
    # Compare by policy: conversation turns (and therefore segment IDs) differ between LLM runs.
    ai = {f["policy_id"] for f in am["findings"]}
    bi = {f["policy_id"] for f in bm["findings"]}
    an = {n["id"]: n for n in a["graph"]["nodes"]}
    bn = {n["id"]: n for n in b["graph"]["nodes"]}
    return {
        "before": am,
        "after": bm,
        "resolved": sorted(ai - bi),
        "new": sorted(bi - ai),
        "changed_nodes": [
            id for id in an.keys() | bn.keys() if an.get(id) != bn.get(id)
        ],
        "same_scenario": a["request"]["scenario"] == b["request"]["scenario"]
        and a["request"]["seed"] == b["request"]["seed"],
        "comparable": a["workflow_id"] == b["workflow_id"]
        and a["mode"] == b["mode"]
        and a["request"]["scenario"] == b["request"]["scenario"]
        and a["request"]["seed"] == b["request"]["seed"]
        and a["request"].get("attack_id") == b["request"].get("attack_id"),
    }


@app.get("/api/agents/{id}")
async def agent(id: str):
    if not re.fullmatch(r"[\w-]{1,100}", id):
        raise HTTPException(422, "Invalid agent ID")
    raw = await BolnaAdapter().agent(id)
    result = {
        "id": id,
        "name": raw.get("agent_name")
        or raw.get("agent_config", {}).get("agent_name")
        or id,
        "provider": "Bolna hosted",
        "capabilities": ["outbound_call", "execution_polling"],
        "limitations": [
            "No arbitrary utterance interception",
            "Automated bidirectional audio caller not connected",
        ],
    }
    store.put("agent", id, result)
    return result


@app.get("/api/agents")
def agents():
    return store.all_docs("agent")


@app.get("/api/bolna/executions/{id}/recording")
async def bolna_recording(id: str):
    """Stream a call recording with the server-side key; the browser never sees provider credentials."""
    if not re.fullmatch(r"[\w-]{1,100}", id):
        raise HTTPException(422, "Invalid execution ID")
    raw = await BolnaAdapter().execution(id)
    url = (raw.get("telephony_data") or {}).get("recording_url")
    if not url:
        raise HTTPException(404, "This call has no recording.")
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        r = await client.get(url, headers={"Authorization": f"Bearer {os.environ['BOLNA_API_KEY']}"})
    if r.status_code != 200:
        raise HTTPException(502, "Recording could not be fetched from Bolna.")
    return Response(r.content, media_type=r.headers.get("content-type", "audio/mpeg"), headers={"Cache-Control": "private, max-age=3600"})


@app.get("/api/bolna/agents/{id}/executions")
async def bolna_agent_executions(id: str):
    if not re.fullmatch(r"[\w-]{1,100}", id):
        raise HTTPException(422, "Invalid agent ID")
    raw = await BolnaAdapter().request("GET", f"/v2/agent/{id}/executions?page_size=10")
    items = raw if isinstance(raw, list) else raw.get("data", raw.get("executions", []))
    return [
        {
            "id": e.get("id"),
            "status": e.get("status"),
            "created_at": e.get("created_at"),
            "duration": e.get("conversation_duration"),
            "has_transcript": bool(e.get("transcript")),
        }
        for e in (items if isinstance(items, list) else [])
        if isinstance(e, dict) and e.get("id")
    ][:10]


@app.post("/api/bolna/executions/{id}/import")
async def import_bolna_execution(id: str):
    if not re.fullmatch(r"[\w-]{1,100}", id):
        raise HTTPException(422, "Invalid execution ID")
    normalized = normalize_execution(await BolnaAdapter().execution(id))
    if not normalized["transcript"]:
        raise HTTPException(422, "Bolna execution has no transcript to import")
    artifact_id = str(uuid.uuid4())
    artifact = {
        "id": artifact_id,
        "name": f"Bolna execution {id}",
        "transcript": redact(normalized["transcript"]),
        "audio": normalized["audio"],
        "created_at": time.time(),
        "coverage": normalized["coverage"],
        "audio_file": None,
        "provider_execution_id": normalized["provider_execution_id"],
        "provider_status": normalized["provider_status"],
        "provider_cost": normalized["cost"],
    }
    store.insert("recording", artifact_id, artifact)
    return artifact


@app.post("/api/tools/execute")
async def tool(req: ToolRequest, x_tool_token: str = Header(default="")):
    token = os.getenv("TOOL_ENDPOINT_TOKEN")
    if not token or not hmac.compare_digest(x_tool_token, token):
        raise HTTPException(401, "Tool authentication required")
    # Trusted identity is server-configured, never taken from spoken instructions or request flags.
    subject = os.getenv("TOOL_SUBJECT_ID", "SYN-001")
    try:
        result = controlled_tool(req.model_dump(), subject, True)
    except ValueError as e:
        raise HTTPException(409, str(e))
    if not result["allowed"]:
        raise HTTPException(403, result)
    return result


@app.post("/api/webhooks/bolna")
async def webhook(request: Request, x_sentinel_signature: str = Header(default="")):
    secret = os.getenv("WEBHOOK_SECRET")
    raw = await request.body()
    if len(raw) > 1024 * 1024:
        raise HTTPException(413, "Payload too large")
    if not secret or not hmac.compare_digest(
        hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest(), x_sentinel_signature
    ):
        raise HTTPException(401, "Invalid gateway signature")
    # This is a Sentinel gateway contract, not an assumed native Bolna signature.
    body = json.loads(raw)
    eid = body.get("execution_id")
    event_id = body.get("event_id")
    if not eid or not event_id:
        raise HTTPException(422, "execution_id and event_id required")
    if store.get("callback", event_id):
        return {"duplicate": True}
    matching = [
        r
        for r in store.all_docs("run")
        if r["status"] == "waiting"
        and any(n.get("provider_execution_id") == eid for n in r["nodes"].values())
    ]
    for r in matching:
        await refresh(r["id"])  # provider is authoritative, callback body is not
    store.insert("callback", event_id, {"execution_id": eid})
    return {"processed": len(matching)}


@app.post("/api/recordings")
async def recording(file: UploadFile = File(...)):
    data = await file.read(20 * 1024 * 1024 + 1)
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(413, "Maximum upload size is 20 MB")
    id = str(uuid.uuid4())
    audio = None
    if file.filename and file.filename.lower().endswith(".json"):
        try:
            raw = json.loads(data)
            segments = raw["transcript"]
            if not isinstance(segments, list) or not 1 <= len(segments) <= 10000:
                raise ValueError()
            previous = 0
            for i, s in enumerate(segments):
                if not isinstance(s["text"], str) or len(s["text"]) > 10000:
                    raise ValueError()
                if s.get("speaker") not in ("caller", "agent", "unknown"):
                    raise ValueError()
                start = float(s["start"])
                end = float(s["end"])
                if not 0 <= start <= end < 86400 or start < previous:
                    raise ValueError()
                previous = start
                segments[i] = {
                    "id": f"s{i + 1}",
                    "text": s["text"],
                    "speaker": s["speaker"],
                    "start": start,
                    "end": end,
                    "timestamp_quality": "imported",
                }
        except (ValueError, KeyError, TypeError):
            raise HTTPException(
                422,
                "Expected JSON transcript array with text, speaker, and ordered numeric start/end seconds",
            )
    else:
        if not file.filename or not file.filename.lower().endswith(
            (".wav", ".mp3", ".m4a", ".webm")
        ):
            raise HTTPException(422, "Upload JSON, WAV, MP3, M4A or WebM")
        try:
            provider = transcription_provider()
        except ValueError as exc:
            raise HTTPException(
                422,
                f"Audio transcription requires a configured provider. {exc} Use a timestamped JSON transcript offline.",
            ) from None
        import httpx

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                provider["url"],
                headers={"Authorization": f"Bearer {provider['key']}"},
                files={"file": (file.filename, data, file.content_type)},
                data={
                    "model": provider["model"],
                    "response_format": "verbose_json",
                    "timestamp_granularities[]": "segment",
                },
            )
        if response.status_code != 200:
            raise HTTPException(
                502, "Transcription failed. Provider payload omitted for privacy."
            )
        segments = [
            {
                "id": f"s{i + 1}",
                "speaker": "unknown",
                "text": s["text"],
                "start": s["start"],
                "end": s["end"],
                "timestamp_quality": "estimated",
            }
            for i, s in enumerate(response.json().get("segments", []))
        ]
        if not segments:
            raise HTTPException(422, "Provider returned no transcript segments")
        extension = file.filename.rsplit(".", 1)[-1].lower()
        path = store.DATA / f"{id}.{extension}"
        path.write_bytes(data)
        audio = f"/api/recordings/{id}/audio"
    artifact = {
        "id": id,
        "name": (file.filename or "Recording")[:120],
        "transcript": redact(segments),
        "audio": audio,
        "created_at": time.time(),
        "coverage": ["Imported transcript coverage is unverified."]
        if not audio
        else ["Machine transcription; timestamps approximate and speakers unknown."],
        "audio_file": str(path) if audio else None,
    }
    store.insert("recording", id, artifact)
    return artifact


@app.get("/api/recordings")
def recordings():
    return [
        {k: v for k, v in a.items() if k != "audio_file"}
        for a in store.all_docs("recording")
    ]


@app.get("/api/recordings/{id}/audio")
def audio(id: str):
    artifact = require("recording", id)
    if not artifact.get("audio_file"):
        raise HTTPException(404, "No audio available")
    return FileResponse(artifact["audio_file"])


@app.delete("/api/recordings/{id}")
def delete_recording(id: str):
    from pathlib import Path

    artifact = require("recording", id)
    if artifact.get("audio_file"):
        Path(artifact["audio_file"]).unlink(missing_ok=True)
    store.delete("recording", id)
    return {
        "deleted": True,
        "note": "Historical redacted run evidence is retained. Delete associated runs separately.",
    }


@app.delete("/api/runs/{id}")
def delete_run(id: str):
    run = require("run", id)
    if run["status"] not in TERMINAL:
        raise HTTPException(409, "Finish or cancel the run first")
    store.delete("run", id)
    store.delete("dispatch", id)
    with store.engine.begin() as c:
        from sqlalchemy import text

        c.execute(text("DELETE FROM events WHERE run_id=:r"), {"r": id})
    for r in store.all_docs("review"):
        if r["run_id"] == id:
            store.delete("review", r["id"])
    return {"deleted": True}


class AttackRequest(BaseModel):
    agent_id: str | None = Field(default=None, max_length=100, pattern=r"^[\w-]+$")
    count: int = Field(default=6, ge=1, le=10)
    language: Literal["en", "hi"] = "en"


@app.get("/api/redteam/prompt")
async def redteam_prompt(agent_id: str | None = None):
    if agent_id and not re.fullmatch(r"[\w-]{1,100}", agent_id):
        raise HTTPException(422, "Invalid agent ID")
    prompt, source = await redteam.agent_prompt(agent_id)
    return {"prompt": prompt, "source": source}


@app.post("/api/redteam/attacks")
async def redteam_attacks(req: AttackRequest):
    if not configured_providers():
        raise HTTPException(422, "Configure GROQ_API_KEY or OPENAI_API_KEY to generate attacks.")
    prompt, source = await redteam.agent_prompt(req.agent_id)
    try:
        attacks = await redteam.generate_attacks(prompt, req.count, req.language)
    except (ValueError, KeyError) as e:
        raise HTTPException(502, f"Attack generation failed: {e}")
    batch = str(uuid.uuid4())[:8]
    for a in attacks:
        a["id"] = f"{a['id']}-{batch}"
        a["source"] = source
        a["created_at"] = time.time()
        store.put("attack", a["id"], a)
    return {"source": source, "attacks": attacks}


@app.get("/api/redteam/attacks")
def redteam_attack_list():
    return sorted(store.all_docs("attack"), key=lambda a: a.get("created_at", 0), reverse=True)


class HardenRequest(BaseModel):
    run_id: str = Field(max_length=64)


@app.post("/api/redteam/harden")
async def redteam_harden(req: HardenRequest):
    run = require("run", req.run_id)
    agent = next((r for r in run["nodes"].values() if (r.get("output") or {}).get("engine")), None)
    findings = {
        f["id"]: f
        for r in run["nodes"].values()
        for f in (r.get("output") or {}).get("findings", [])
    }
    if not agent or not findings:
        raise HTTPException(422, "Harden needs a completed red-team run with findings.")
    output = agent["output"]
    node = next(n for n in run["graph"]["nodes"] if n["type"] == "bolna")
    prompt, _ = await redteam.agent_prompt(
        run["request"].get("agent_id") or node["data"].get("config", {}).get("agent_id"),
        node["data"].get("config", {}).get("agent_prompt", ""),
    )
    try:
        return await redteam.harden(prompt, output.get("transcript", []), list(findings.values()), output.get("attack") or {})
    except (ValueError, KeyError) as e:
        raise HTTPException(502, f"Hardening failed: {e}")


class PushPromptRequest(BaseModel):
    patch: str = Field(min_length=10, max_length=8000)


@app.post("/api/bolna/agents/{id}/guardrails")
async def push_guardrails(id: str, req: PushPromptRequest):
    """Append Sentinel's guardrail patch to the hosted Bolna agent's system prompt (creates a new agent version)."""
    if not re.fullmatch(r"[\w-]{1,100}", id):
        raise HTTPException(422, "Invalid agent ID")
    raw = await BolnaAdapter().agent(id)
    prompt = ((raw.get("agent_prompts") or {}).get("task_1") or {}).get("system_prompt") or ""
    marker = "# SECURITY GUARDRAILS (added by Sentinel)"
    base = prompt.split(marker)[0].rstrip()
    updated = f"{base}\n\n{req.patch.strip()}"
    await BolnaAdapter().request("PATCH", f"/v2/agent/{id}", {"agent_prompts": {"task_1": {"system_prompt": updated}}})
    store.delete("agent_prompt", id)
    return {"agent_id": id, "updated": True, "prompt_chars": len(updated)}
