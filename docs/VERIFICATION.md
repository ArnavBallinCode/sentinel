# Verification — 23 October 2026

## Current checks

- Backend suite: **46 passed**, including coverage failures, provider-log provenance, replay identity, comparison controls, recording credential isolation, guardrail-section preservation, bilingual release checks and refusal-only behavior.
- Browser suite: **5 passed** against an isolated credential-free backend. Covers editor execution and replay, node trace/evidence, privacy import/review/export, persistent state, theme/compact/fullscreen/sidebar controls, demo studio and zero-policy inconclusive results.
- TypeScript typecheck passed.
- Optimized Next.js production build passed, including `/` and `/demo`.
- Desktop (1600×1000) and compact (390×844) Studio layouts inspected; compact page had no horizontal document overflow.
- One upstream Starlette TestClient deprecation warning remains; it does not fail the suite.

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

Install dependencies and Chromium, then run `bash scripts/verify.sh`. It uses a temporary database, clears external keys, starts isolated services, runs the checks and stops its services. The script prints the logs directory. Do not point the browser suite at the working user database.

## Scope that remains open

Shared multi-tenant production deployment, autonomous audio adversaries, precise speech alignment/omission recovery, comprehensive contextual/spoken PII detection, redacted audio exports, and general safety/accuracy claims remain outside the verified local MVP.
