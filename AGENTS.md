# Sentinel — contributor handoff

Read this file before changing the product. `CLAUDE.md` points here so every coding tool shares the same context.

## Product and current priorities

Sentinel tests voice-agent prompts, enforces authorization in its synthetic/controlled tool boundary, and audits real Bolna call artifacts. The submission is a private GitHub repository and a recorded YouTube product demonstration. Optimize for a truthful, understandable, testable product. The demo studio is `/demo`; the editable workflow workspace is `/`.

Start with `docs/HANDOFF.md`, `docs/DEMO.md`, and `docs/VERIFICATION.md`. The original reference applications informed this native implementation; they are not four bundled engines. See `docs/REPO_AUDIT.md`.

## Execution modes and claims

- **Scripted rehearsal:** authored fixtures, no model or telephone provider. Fixture improvement is not measured LLM accuracy.
- **LLM prompt evaluation:** copied prompt, configured model, synthetic tools and identity. This does not reproduce the whole hosted Bolna voice stack.
- **Live Bolna:** an authorized allowlisted participant receives a real phone call. A returned execution ID alone is not a completed conversation.
- **Call audit:** provider or uploaded evidence, evaluated after the conversation. Never call this preventive blocking without a verified original enforcement receipt.
- TTS read-aloud is not original recording audio. Estimated timestamps are not precise alignment. Text redaction does not sanitize recordings.
- Zero findings without sufficient validated policy coverage means inconclusive. Never add a green shortcut to improve the demo.

## Architecture

- `apps/web`: Next App Router, React Flow, Zustand; `/demo` is an independent presentation surface.
- `services/api/sentinel/main.py`: API and integrations; `executor.py`: persisted graph execution and SSE.
- `results.py`: central conservative verdict and controlled-comparison rules.
- `campaigns.py`: bounded English/Hindi release suite, persisted individual runs and legitimate-task controls.
- `redteam.py`: model conversations, judge, prompt hardening. `run_context` stores private original prompt snapshots for replay.
- `recordings.py`: public HTTPS recording fetch with no forwarded Bolna credential.
- `prompt_updates.py`: bounded guardrail section replacement; hosted deployment has stale-prompt protection and rollback.
- SQLite documents/events live under `SENTINEL_DATA_DIR`; keep databases and call artifacts out of Git.

## Working rules

Preserve user work and existing history. Inspect `git status` first. Read `apps/web/AGENTS.md` and the installed Next documentation before frontend changes. Do not place calls, update hosted prompts, or publish new evidence as a side effect of tests. Integration smoke tests must explicitly identify their external requests and use synthetic inputs where possible.

Keep `.env`, tokens, recordings, raw provider payloads, local databases and private prompt snapshots out of commits and logs. Existing dependency notices remain intact. Do not replace truthful limitations with marketing claims or regulatory certification language.

## Verification

- `uv run --directory services/api pytest -q`
- `npm run typecheck`
- `npm run build`
- `bash scripts/verify.sh` for an isolated provider-free backend + browser suite + production build.

Do not test against the user's working database. The suite creates versions, runs and synthetic artifacts. New functionality needs behavioral tests, especially missing evidence, refusal-only behavior, stale versions, external side effects and replay identity. Record exactly which live paths were verified separately from fixtures and mocks.
