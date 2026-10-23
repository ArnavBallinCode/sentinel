# Reference and dependency review — 22 October 2026

The supplied workspace was empty. No `.git` directory, existing implementation, or upstream commit history existed to remove. Sentinel was implemented from scratch. No source files, assets, or Git objects were copied from the reference applications. Sibling directories were not modified.

| Reference | Inspected | Decision |
| --- | --- | --- |
| [Bolna](https://github.com/bolna-ai/bolna) | README, API.md, hosted v2 documentation and official MCP transport references; GitHub reports MIT | Implement a native hosted adapter. Open-source agent APIs differ from hosted v2 APIs. Do not bundle the orchestrator or guess self-hosted audio contracts. |
| [RecoveryCall QA](https://github.com/arnavgupta2004/recoverycall-qa) | README and app.py; GitHub reports MIT | Reimplement evidence-linked findings and explicit coverage uncertainty. Do not reuse reported accuracy, cached audio, or the transcription-recovery pipeline. |
| [Convox](https://github.com/rohansx/convox) | README and docs/architecture.md; GitHub reports Apache-2.0 | Adopt deterministic-before-semantic evaluation and explicit unsupported assertions as design principles. Its larger worker architecture and audio adapters were not imported. |
| [Voice AI Governance](https://github.com/ashutoshrana/voice-ai-governance) | README and PII module reference; GitHub reports MIT | Independently implement a small trusted-identity authorization boundary. No regulatory certification or provider-wide interception claim. |
| [Bolna issue 933](https://github.com/bolna-ai/bolna/issues/933) | Proposal description | Design reference only, not an available Bolna feature. |
| [n8n](https://github.com/n8n-io/n8n) | Product reference and LICENSE.md | No source or visual assets copied. Its source licensing is not treated as permission to relicense n8n. |
| [React Flow](https://github.com/xyflow/xyflow) | Official documentation and MIT license | Installed `@xyflow/react` as the editor dependency. Its package license and attribution link remain intact. |

## Implemented hosted contracts

- `GET /v2/agent/{agent_id}` — [official v2 agent documentation](https://www.bolna.ai/docs/api-reference/agent/v2/get).
- `POST /call` with `agent_id` and `recipient_phone_number` — [official call documentation](https://www.bolna.ai/docs/api-reference/calls/make).
- `GET /executions/{execution_id}` — verified against [Bolna's official MCP read tools](https://github.com/bolna-ai/mcp/blob/main/src/tools/read.ts).
- [Bolna callback guidance](https://www.bolna.ai/docs/poll-call-data) describes provider call updates. Sentinel does not assume a native HMAC header: its signed endpoint is a separate, explicitly documented gateway contract and refetches provider data.

These contracts were checked against documentation/source and then exercised with a live credentialed account on 22 October 2026. Sentinel authenticated to Bolna, listed and retrieved the connected agent, initiated an API call that received a provider execution ID, and imported a completed dashboard-initiated execution for audit. The API-initiated call ended with the provider status `busy`, so it is not represented as a completed Sentinel-dispatched call. Local adapter tests remain HTTP mocks and are not live-call evidence.

## Dependency notices

Installed dependencies retain their upstream license files. Core packages include Next.js, React, React Flow, Zustand, Tailwind, Radix primitives, Lucide, Dagre, FastAPI, SQLAlchemy, HTTPX, Uvicorn and Pydantic. Lockfiles record exact resolved dependency versions. The small Button component uses the conventional Radix/shadcn-compatible composition of CVA, clsx and tailwind-merge; no third-party application source was bulk-copied.

Removing Git history does not erase dependency license obligations. No extra upstream history is retained in this project. Preserve package license notices when distributing bundled dependencies.
