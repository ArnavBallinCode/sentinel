# Sentinel

**Test the conversation. Verify the action.**

[![Verify Sentinel](https://github.com/ArnavBallinCode/sentinel/actions/workflows/verify.yml/badge.svg)](https://github.com/ArnavBallinCode/sentinel/actions/workflows/verify.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Reviewer walkthrough](docs/REVIEWER_GUIDE.md) · [Demo script](docs/DEMO.md) · [Architecture](docs/ARCHITECTURE.md) · [Verified scope](docs/VERIFICATION.md)

Sentinel is a visual testing and evidence workspace for teams building AI voice agents. Challenge a prompt, inspect tool decisions, review a guardrail change, and replay the test. Bring actual Bolna call artifacts into a separate audit workflow.

![Sentinel demo studio](docs/demo-studio.png)

## Why Sentinel

A voice agent can sound helpful while attempting an unauthorized action. A guardrail can stop that behavior but make the agent refuse legitimate requests. Sentinel lets a team examine both sides of the change: **what the agent tried, why the tool allowed or denied it, and whether the useful task still completed**.

The first use case is lending and customer support: account access, payment disputes and escalation in English and Hindi. Engineers use the workflow before changing a prompt; operations reviewers use the same evidence tools after a call complaint.

## Run the demo — no API keys

Requires **Node.js 22+**, **[uv](https://docs.astral.sh/uv/)** and a Bash shell (macOS, Linux or WSL). Python 3.13 is pinned; uv can install it. The repository is private, so cloning requires access from the owner.

```bash
git clone https://github.com/ArnavBallinCode/sentinel.git
cd sentinel
npm run demo
```

The launcher installs missing dependencies, starts both services, and prints the local address. Open **http://127.0.0.1:3000/demo**. Press **Ctrl+C** to stop both services.

This mode ignores `.env`, disables provider access and keeps its own local state in `artifacts/reviewer-data/`. Dependency installation needs internet access; the rehearsal itself makes no model or telephone-provider requests. Existing working data is kept separate.

Prefer containers? With Docker Compose available, run `docker compose up --build --wait`, then open the same address. On a fresh clone with no `.env`, this also needs no API keys. Stop with `docker compose down`; the named data volume persists. [Setup and troubleshooting](docs/DEPLOYMENT.md).

### Try the product in two minutes

1. Open Demo Studio and choose **Rehearsal · free / offline**.
2. Run the release check. It executes 16 persisted workflow runs across eight English/Hindi cases and two variants.
3. Click a baseline result to inspect the transcript, denied test-tool request and finding.
4. Inspect the hardened result and the legitimate-task controls. An agent that refuses every request does not pass.
5. Open the workflow trace to inspect individual nodes. Export the evidence or reopen the saved release check.

The expected authored-fixture result is 2/8 baseline and 8/8 hardened, with four useful-task completions. This verifies the application workflow; it is **not measured model accuracy**. Actual prompt-evaluation outcomes are allowed to differ or fail.

For a guided evaluation of the full product, follow the [five-minute reviewer walkthrough](docs/REVIEWER_GUIDE.md).

## Three evidence levels

| Mode | What actually runs | What it establishes |
| --- | --- | --- |
| Scripted rehearsal | Authored synthetic conversations and tool decisions | Reproducible product/engine behavior without external services |
| LLM prompt evaluation | Attacker, target and judge models; captured prompt; synthetic tools and identity | Behavior of that prompt/model configuration on the selected cases |
| Live Bolna / call audit | Authorized phone dispatch and/or actual provider execution artifacts | Available evidence from that hosted conversation; audit findings are retrospective |

Prompt evaluation is not a test of the full hosted voice stack. Browser read-aloud is not an original recording. Estimated audio times are labeled. The curated suite is not a held-out benchmark or certification.

## What is implemented

- React Flow editor with graph validation, saved versions, conditional branches and persisted execution records.
- Node-level input/output/trace/evidence inspection, live events, history, fullscreen canvas and collapsible navigation.
- Multi-turn LLM prompt testing, generated attacks, a validated evidence-citing judge, and proposed guardrail patches.
- Baseline replay with original request/prompt context and conservative comparison rules.
- Bilingual release checks with actual required-tool checks for legitimate tasks.
- Groq or OpenAI model/transcription providers; API credentials remain server-side.
- Hosted Bolna agent connection, opted-in call dispatch, execution import and available signed-recording playback.
- Pattern-based PII text redaction, coverage warnings, human-review records and evidence exports.
- Hosted prompt update with stale-version rejection, bounded section replacement and guarded rollback.

## Connect your own agent or model

Stop the offline demo first, then create a local configuration and start the working workspace:

```bash
cp .env.example .env
# Add the provider keys you want to use, then:
npm run dev
```

`npm run dev` starts the frontend and API together. The workflow editor is at **http://127.0.0.1:3000/**; the API is at **http://127.0.0.1:8001**. Do not overwrite an existing `.env`.

Set `GROQ_API_KEY` or `OPENAI_API_KEY` in `.env` for prompt evaluation. Auto selection prefers Groq. Groq is not unlimited: provider limits and any account charges still apply. Roles are configurable using `TARGET_MODEL`, `ATTACKER_MODEL` and `REDTEAM_MODEL`.

Set `BOLNA_API_KEY` to connect agents and import provider artifacts. For an actual call, verify the recipient with Bolna as required by your plan, add it to `ALLOWED_TEST_NUMBERS`, and explicitly authorize the call in the UI. `MAX_LIVE_CALLS_PER_DAY` bounds local dispatches.

Original recording playback requires a supported public/signed HTTPS URL. Sentinel never forwards its Bolna key to a recording host. Set `RECORDING_ALLOWED_HOSTS` to restrict exact hostnames. The original audio is not redacted.

Use the workspace's **Connect Bolna**, **Live voice call**, and **Recordings** actions. A configured key is not proof of a healthy connection; an execution ID is not proof of a completed call.

## Verify

```bash
npx playwright install chromium
bash scripts/verify.sh
```

The script runs backend tests, TypeScript checks, an optimized build, then browser tests **against that production build** with a temporary credential-free database. It never calls a phone number or updates a hosted agent. Logs remain in the printed temporary directory. GitHub CI runs the same checks plus a container startup and 16-run rehearsal smoke test.

Individual commands:

```bash
uv run --directory services/api pytest -q
npm run typecheck
npm run build
```

Use `npm run verify` for the isolated browser suite. It intentionally creates workflows, runs and synthetic uploads; do not direct it at your working database.

## Layout

```text
apps/web/                 Next.js UI, workflow workspace and /demo
services/api/sentinel/    Workflow engine, providers, governance, results, campaigns
services/api/tests/       Backend behavioral/integration tests (HTTP mocks where appropriate)
tests/e2e/                Browser acceptance tests
scripts/                  Startup, isolated verification, synthetic capture and retention
docs/                     Architecture, verification, pitch and handoff
```

## Deployment and boundaries

This is a single-user local MVP. Public multi-user deployment needs authenticated tenant isolation and operational hardening. Tool enforcement is preventive only when the original request reaches Sentinel's controlled boundary with trusted identity. Imported tool logs are observations.

Text PII controls are heuristic and do not comprehensively detect names, addresses, spoken identifiers or sensitive audio. Speech-omission recovery, autonomous voice attackers and production speech-quality evaluation are future work. See [deployment notes](docs/DEPLOYMENT.md) and [reference audit](docs/REPO_AUDIT.md).

Local secrets, databases, recordings and raw private evidence are excluded from Git. Dependency license notices remain intact. The reference applications informed a native implementation; they are not bulk-merged engines.

## Submission and contributors

The repository contains the working application, locked dependencies, synthetic example transcript, automated checks, screenshots, a [recorded-demo script](docs/DEMO.md) and [standalone narration](docs/PITCH_NARRATION.txt). The final narrated video is a separate submission artifact; the local silent B-roll is not the finished film.

For engineering changes, start with [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). [CLAUDE.md](CLAUDE.md) points to the same handoff so future tools share the product context.

Sentinel's original code is [MIT licensed](LICENSE). Dependency notices and [reference provenance](docs/REPO_AUDIT.md) are preserved.
