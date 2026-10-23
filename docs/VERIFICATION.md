# Verification — 23 October 2026

## Current checks

- Backend suite: **46 passed**, including coverage failures, provider-log provenance, replay identity, comparison controls, recording credential isolation, guardrail-section preservation, bilingual release checks and refusal-only behavior.
- Browser suite: **5 passed against the optimized production build**, with an isolated credential-free backend. Covers editor execution and replay, node trace/evidence, privacy import/review/export, persistent state, theme/compact/fullscreen/sidebar controls, demo studio and zero-policy inconclusive results.
- TypeScript typecheck passed.
- Optimized Next.js production build passed, including `/` and `/demo`.
- Desktop (1600×1000) and compact (390×844) Studio layouts inspected; compact page had no horizontal document overflow.
- One upstream Starlette TestClient deprecation warning remains; it does not fail the suite.

## Submission packaging checks

- The offline launcher was exercised on macOS with a synthetic provider-key value and an unrelated database URL in the parent environment. Settings confirmed no provider access; the separate reviewer database completed a 16-run fixture campaign, persisted evidence and exported a run.
- An occupied-port launch failed clearly before starting services. Stopping the owned launcher released both ports.
- Local Markdown links, tracked artifact exclusions and a credential-pattern scan passed. This is repository hygiene, not a claim of exhaustive security auditing.
- Docker Compose configuration validates. CI builds both containers and runs the same offline campaign through the production frontend's API proxy; see the current [GitHub checks](https://github.com/ArnavBallinCode/sentinel/actions/workflows/verify.yml). The local Docker daemon was unavailable during this pass, so container execution is checked on the CI runner.
- No new model request, phone call or hosted prompt update was made during submission packaging. The earlier external-model result below is recorded separately.

## Fresh external model verification

Using the configured Groq account, a read-only model-list request succeeded and confirmed the configured target, attacker and judge model IDs were available.

A fresh synthetic-input LLM smoke test ran against the demo finance prompt using the actual Groq API:

1. Baseline completed with one finding.
2. The real model-generated hardening endpoint succeeded.
3. Replay completed with a passing evaluated result.
4. Comparison accepted the pinned inputs and guardrail-only treatment change.

This was one prompt-level example, not a full statistical campaign or a hosted phone conversation. The 16-run LLM campaign has not been reported as live-verified. Provider response variability and rate limits remain relevant. The full 16-run fixture campaign was exercised through backend and browser tests.

## Bolna verification boundary

The earlier integration record (22 October) authenticated to Bolna, retrieved the connected agent, dispatched a call that ended `busy`, and imported a separate completed dashboard call with 15 transcript segments. That is not evidence of a completed Sentinel-dispatched conversation. No new telephone call or hosted prompt update was performed during this demo-preparation pass.

Recording download security and prompt deployment/rollback behavior are tested locally with mocks and deterministic helpers; availability of a specific provider recording URL and the hosted prompt-update contract still need account-level verification before filming those as completed operations.

## Reproduce

Install dependencies and Chromium, then run `npm run verify` (equivalent to `bash scripts/verify.sh`). It uses a temporary database, clears external keys before all tests, checks port availability, starts isolated services, exercises the production build and stops its services. The script prints the logs directory. Node 22 and Python 3.13 are pinned for CI. Do not point the browser suite at the working user database.

## Scope that remains open

Shared multi-tenant production deployment, autonomous audio adversaries, precise speech alignment/omission recovery, comprehensive contextual/spoken PII detection, redacted audio exports, and general safety/accuracy claims remain outside the verified local MVP.
