# Verification — 22 October 2026

## Automated checks passed

- `uv run --directory services/api pytest -q`: **24 passed**. One upstream Starlette deprecation warning recommends a future TestClient transport migration from HTTPX; no test failures.
- `npm run typecheck`: passed.
- `npm run build`: production Next.js build passed.
- `docker compose config --quiet`: passed.
- `docker compose build`: both `sentinel-api` and `sentinel-web` built successfully.
- Isolated Docker containers: web returned HTTP 200; frontend rewrite reached the API; baseline graph executed; saved refusal configuration produced a second immutable version; rerun passed and comparison resolved `identity-s1`.
- Backend restart: the original baseline run remained completed at version 1, with all nine node records preserved.

## Backend coverage

Templates and DAG validation; invalid references/connections/configuration; optimistic version conflicts; graph-driven baseline/fix/retest; immutable historical evidence; disabled assertions; four scenario outcomes; exact finding-to-transcript mapping; SSE replay/cursors; trusted authorization; idempotency mismatch; outbound call authorization gates; artifact import and malformed uploads; PII redaction; independent human reviews; recording/run deletion; signed gateway rejection and deduplication; cancellation; safe retry attempts; forbidden provider retry settings; provider error sanitization; hosted waiting/resumption without duplicate call dispatch; missing provider evidence; origin checks and optional API token.

Provider adapter tests use HTTP mocks and injected transports. They are offline contract tests, not proof that a real Bolna account or voice call succeeded.

## Browser walkthrough passed

- Opened the live app, executed the baseline graph, inspected real backend event history.
- Selected a policy event, opened the corresponding node inspector, and saw its blocked finding with the exact source quote.
- Clicked the evidence timestamp and saw the linked transcript segment.
- Changed the simulated agent's refusal setting and reran. The new transcript refused access; the unauthorized tool request disappeared.
- Compared v1 and v2: baseline needed review, new run passed, one finding resolved, one node changed.
- Added an unconnected End node. Validate rejected the graph. Undo restored a valid graph.
- Opened the production build after backend restart and confirmed the persisted workflow loaded.
- Checked desktop and compact layouts and dark theme. This is a desktop-oriented graph editor; compact screens have a constrained canvas and hide the node library.

The Playwright test file is included for repeatable local browser CI, but its command-line runner was not executed in this delivery. The described UI flow was executed via the available browser automation tool.

## Not verified / blocked

Live verification on 22 October 2026 authenticated a Bolna account, retrieved the `bolnasymphony` agent, imported a completed dashboard-generated call (15 transcript segments), and ran the persisted audit workflow against it. A Sentinel API-dispatched call was accepted and assigned a provider execution ID, then ended with provider status `busy`; it did not produce a completed call artifact. The hosted provider did not expose recording audio or aligned transcript timestamps for the imported call, so acoustic coverage validation remains open. Multi-tenant authorization, public deployment, autonomous audio callers, and comprehensive production-grade PII classification remain outside this local MVP.

Screenshots in this directory show actual local application state, not generated mockups. Earlier development hot-reload warnings occurred when an effect's dependencies changed during editing; the production build and subsequent type checks passed.
