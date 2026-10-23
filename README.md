# Sentinel

**The testing and governance layer for AI voice agents.**

Sentinel is a local, single-user visual workflow workspace. Build an execution graph, test an agent's behavior, enforce authorization at controlled tools, inspect grounded evidence, and compare immutable runs.

This is a working offline MVP, not a production compliance product. Simulation is explicitly transcript-only. Hosted Bolna, optional semantic evaluation, and audio transcription are implemented but require credentials and live verification.

## Start locally

Requires Node.js 22+, Python 3.11+, and [uv](https://docs.astral.sh/uv/).

```sh
npm ci
uv sync --directory services/api --frozen
./scripts/dev.sh
```

Open **http://127.0.0.1:3000**. Backend health: http://127.0.0.1:8000/api/health. API schema: http://127.0.0.1:8000/docs.

The script starts both processes and shuts down its API process when the frontend exits. Ports 3000 and 8000 must be free. No Git repository, imported commits, or upstream source trees are included.

For independent terminals:

```sh
uv run --directory services/api uvicorn sentinel.main:app --host 127.0.0.1 --port 8000
npm run dev
```

The database and uploaded files live in `services/api/data/` by default. SQLite tables are initialized on first startup and seed three workflows. Run one API worker. Build output is verified with `npm run build`; then use `npm run start -w apps/web` with the API running separately.

## Three-minute demo

1. Home → **Run the attack demo**. Pick **Target** (the built-in demo agent, or your Bolna agent), **Attack → Prompt injection**, **Prompt → Baseline**, then **Run test** (⌘↵).
2. Watch the **Conversation** tab fill live: an LLM attacker escalates for three turns against the agent's real system prompt. Every tool call the agent makes is decided by Sentinel, not the model.
3. The verdict lands: **"Agent was manipulated — Sentinel blocked the leak"**, with the blocked `get_account_status(SYN-002)` pinned to the exact agent turn. Press **Play call** to hear it.
4. Click **Harden agent & retest**. Sentinel writes a guardrail patch from the failing transcript, saves a new workflow version, replays the same attack and seed, and shows **Before 1 → After 0 · Resolved: identity**, with the rules it added. With a Bolna target, **Push guardrails to Bolna agent** patches the hosted agent.
5. Click ✨ next to the attack picker to generate six new attacks from the agent's own prompt (set the Scenario node to `hi` for Hinglish).
6. Sidebar → **Recordings** → **Audit this call** on a recent Bolna call: Sentinel imports the transcript, plays the **real call recording**, and the judge flags manipulation, disclosure and PII line by line.

Without `GROQ_API_KEY`/`OPENAI_API_KEY`, simulations fall back to the deterministic scripted fixture and say so. The demo agent is deliberately under-specified (helpful-first, no authorization rules), which is a realistic production failure.

## What works

- **LLM red-team engine** (`services/api/sentinel/redteam.py`): attack generation from the agent's prompt, multi-turn attacker-vs-agent conversations streamed live, Sentinel-decided tool calls, an LLM judge whose citations are grounded by construction (it names a segment; Sentinel copies the exact text), and guardrail patch generation for **Harden & retest**.
- **Real Bolna calls**: recent-call listing, one-click audit, server-proxied call recordings, estimated turn timing, provider tool-call logs when present, and pushing guardrails to the hosted agent (`PATCH /v2/agent/{id}`).
- React Flow graph editing: search/insert/drag/connect/delete, multi-selection, copy/paste, duplicate, undo/redo, Dagre layout, minimap, zoom, light/dark theme.
- Registry of 17 implemented node types; typed connection validation, DAG validation, configuration validation, immutable workflow versions and local publication.
- FastAPI executor interpreting the actual saved graph, conditional pass/review branches, skipped branches, bounded safe-handler retries and timeouts, cancellation for local runs, durable event replay through SSE.
- Per-node inputs, outputs, duration, attempts, errors, exact transcript citations, separate human reviews, JSON export and run comparisons.
- Four authored synthetic scenarios: normal inquiry, payment dispute, unauthorized lookup, and authorization bypass. English and Hindi caller prompts; English agent replies (Hindi conversation simulation is partial).
- Real authorization decisions with idempotent synthetic tools. Request-supplied identity cannot override trusted server-side identity.
- JSON transcript ingestion, timestamp-gap warnings, manual recording/run deletion, and explicit retention maintenance.
- Hosted Bolna adapter for agent metadata, outbound calls, durable waiting state and execution polling. Gateway-authenticated callback ingestion triggers authoritative provider fetches.
- Optional OpenAI transcription and semantic evaluation. Semantic citations are rejected if they don't exactly match the supplied segment.

## Tests

```sh
# Offline unit, integration and full API regression tests. No paid providers invoked.
uv run --directory services/api pytest -q
npm run typecheck
npm run build
```

A Playwright browser regression is provided in `tests/e2e/workflow.spec.ts`. Start both servers against an empty disposable data directory, then run:

```sh
npx playwright install chromium
npm run test:e2e
```

31 offline API tests and all three Playwright scenarios pass against an isolated data directory (attack → blocked leak → harden & retest → regression proof; privacy audit and review; navigation, theme and compact layout). See [verification results](docs/VERIFICATION.md).

## Provider configuration

Copy `.env.example` to `.env` and populate only the integrations you need. `scripts/dev.sh` loads it into the backend. No provider credentials go to the browser.

| Variable | Purpose |
| --- | --- |
| `BOLNA_API_KEY` | Hosted Bolna agent lookup, outbound call, execution fetch |
| `ALLOWED_TEST_NUMBERS` | Comma-separated explicitly opted-in E.164 test numbers |
| `MAX_LIVE_CALLS_PER_DAY` | Local rolling 24-hour dispatch limit; defaults to 5 |
| `GROQ_API_KEY` | Optional Groq transcription and semantic evaluator; selected first by `auto` |
| `OPENAI_API_KEY` | Optional OpenAI transcription and semantic evaluator fallback |
| `EVALUATOR_PROVIDER` / `TRANSCRIPTION_PROVIDER` | `auto`, `groq`, or `openai`; `auto` prefers Groq when configured |
| `TARGET_MODEL` / `ATTACKER_MODEL` / `REDTEAM_MODEL` | Groq models for the agent under test (`openai/gpt-oss-20b`), the attacker (`qwen/qwen3.8-27b`), and the generator/judge/hardener (`openai/gpt-oss-120b`). Groq's free tier allows 8k tokens/minute per model, so long production prompts (~30k characters) need a paid Groq tier or `OPENAI_API_KEY` |
| `GROQ_EVALUATOR_MODEL` / `GROQ_TRANSCRIPTION_MODEL` | Groq defaults: `openai/gpt-oss-20b` and `whisper-large-v3-turbo` |
| `EVALUATOR_MODEL` / `TRANSCRIPTION_MODEL` | OpenAI defaults: `gpt-4.1-mini` and `whisper-1` |
| `TOOL_ENDPOINT_TOKEN` | Shared secret for the synthetic tool endpoint |
| `TOOL_SUBJECT_ID` | Trusted synthetic identity; defaults to `SYN-001` |
| `WEBHOOK_SECRET` | HMAC secret for a Sentinel-owned callback gateway |
| `SENTINEL_DATA_DIR` | Local database and recording directory |
| `ALLOWED_ORIGINS` | Allowed browser mutation origins |
| `SENTINEL_API_TOKEN` | Optional API gateway token; your reverse proxy must inject `X-Sentinel-Token` for both browser and integration traffic when enabled |

Do not set the optional API token without configuring the proxy; the stock Next.js rewrite does not inject it. Default startup binds only to localhost and is for one trusted local user.

See [live verification and deployment](docs/DEPLOYMENT.md), [architecture](docs/ARCHITECTURE.md), [source review](docs/REPO_AUDIT.md), [remaining scope](docs/IMPLEMENTATION_PLAN.md), and [demo pitch](docs/DEMO.md).

## Docker

```sh
docker compose up --build
```

Compose binds exposed ports to loopback and persists data in a named volume. Requires Compose supporting optional `env_file` entries. Both Docker images built successfully, and their isolated frontend/API containers passed an end-to-end regression smoke test. Do not expose this local MVP publicly without authentication, per-project authorization, durable worker coordination, and infrastructure review.

## Deliberate boundaries

No arbitrary code/script node, general HTTP node, database node, unrestricted URLs, or fabricated integration is exposed. Automated bidirectional audio callers, self-hosted Bolna transport, live utterance interception, incoming-call routing, scheduler, multi-tenant projects, full multilingual evaluation, and production deployment are not implemented. Audio timestamps are imported or estimated; coverage gaps are heuristics, not acoustic proof. Heuristic PII redaction is incomplete. Raw uploaded audio is retained locally until deletion.

No live provider call or regulatory compliance claim is made. Third-party dependency notices remain with their packages; source and license decisions are recorded in `docs/REPO_AUDIT.md`.
