# Startup, live verification and deployment

## Local start

Use **`npm run demo`** for the credential-free reviewer experience. It ignores `.env` and inherited provider keys, uses `artifacts/reviewer-data/`, and starts the API on loopback port **8001** plus Next.js on **3000**. Dependency installation requires network access; scripted rehearsal does not use external providers.

Use **`npm run dev`** for the configured workspace. It installs missing JavaScript dependencies, syncs the locked Python environment and reads the root `.env` if present. Stop either launcher with Ctrl+C; both owned services are stopped. The launcher refuses occupied ports rather than connecting the UI to an unrelated API.

On restart, saved graphs, runs and events survive. Waiting provider executions can be refreshed; uncertain running calls become interrupted and must be inspected in the provider dashboard before another dispatch. Use one API worker. Shared or public hosting is outside this local MVP's authentication/tenant model.

### Configuration and local data

Copy `.env.example` to `.env` only when no local configuration already exists. Keep all credentials server-side. Restart the configured workspace after changing it.

| Setting | Purpose |
| --- | --- |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | Prompt testing, judging and optional transcription; auto selection prefers Groq |
| `EVALUATOR_PROVIDER` / `TRANSCRIPTION_PROVIDER` | `auto`, `groq` or `openai` |
| `TARGET_MODEL`, `ATTACKER_MODEL`, `REDTEAM_MODEL` | Groq prompt-test role overrides; OpenAI uses `EVALUATOR_MODEL` for each role |
| `BOLNA_API_KEY` | Hosted agent connection, execution retrieval and explicitly requested calls/updates |
| `ALLOWED_TEST_NUMBERS`, `MAX_LIVE_CALLS_PER_DAY` | Recipient allowlist and local dispatch limit; provider verification rules also apply |
| `RECORDING_ALLOWED_HOSTS` | Optional comma-separated exact hosts for signed/public HTTPS audio |
| `SENTINEL_DATA_DIR` | Backend evidence storage; use an absolute path when overriding |
| `ALLOWED_ORIGINS` | Browser origins allowed to make API mutations |
| `TOOL_ENDPOINT_TOKEN`, `TOOL_SUBJECT_ID` | Controlled synthetic tool endpoint and server-owned identity |
| `WEBHOOK_SECRET` | Optional signed gateway callback contract below |

The default configured launcher runs Python from `services/api`, so `SENTINEL_DATA_DIR=data` resolves to `services/api/data/`. The offline demo has its own absolute data path. Both are ignored by Git. Do not point multiple API processes at the same database.

`SENTINEL_API_TOKEN` is an optional API gateway restriction, not a browser login or tenant system. The UI does not attach this token itself; leave it empty for local use, or configure an authenticated reverse proxy that injects it. Do not expose the token to browser JavaScript.

### Docker Compose

```bash
docker compose up --build --wait
# Open http://127.0.0.1:3000/demo
docker compose down
```

Compose optionally reads the root `.env`. With none present, it runs without provider credentials. It exposes only loopback ports 3000 (web) and 8001 (API); the API's internal container port is 8000. The frontend binds inside its container and proxies to `http://api:8000`. Health checks include the proxied API. Evidence is stored in the named `sentinel-data` volume and survives `down`. Removing that volume deletes its evidence; it is not necessary for normal shutdown.

GitHub CI builds both images and runs `scripts/smoke-offline.mjs` against fresh, credential-free containers. The smoke check creates a complete synthetic release campaign and verifies persisted evidence and export.

### Troubleshooting

| Symptom | Action |
| --- | --- |
| Port already in use | Stop your earlier Sentinel instance, or use `DEV_API_PORT=8014 DEV_WEB_PORT=3014 npm run demo`. For configured development, also add the chosen web origin to `ALLOWED_ORIGINS`. |
| Browser cannot reach the API | Start both services with the launcher. Check `http://127.0.0.1:8001/api/health`; refresh after startup completes. |
| Python is missing | Run `uv python install 3.13`, then restart. Use the checked-in lockfile. |
| Playwright browser is missing | Run `npx playwright install chromium`; on Linux use `npx playwright install --with-deps chromium`. |
| Model request is rate-limited or rejected | Check the selected provider, account/model access and usage allowance. Rehearsal remains available without keys. |
| Live call rejected | Verify the number with Bolna if required, use E.164 in the local allowlist, check the daily cap and explicitly authorize the call. |
| Original audio unavailable | A transcript may still be auditable. Only public/signed HTTPS recording URLs are supported; TTS is not a substitute for original audio. |
| Docker daemon unavailable | Start Docker Desktop or your Docker-compatible runtime, or use the native launcher. |

## Hosted Bolna checklist

1. Configure a valid `BOLNA_API_KEY`, `ALLOWED_TEST_NUMBERS` containing an explicitly opted-in E.164 number, and the default low daily call limit. Restart the backend.
2. Open Settings; enter a real agent ID and choose **Verify & connect agent**. Record the successful metadata response without exposing credentials.
3. Select **Voice agent workflow**. The adversarial template includes a simulation-only caller and will correctly reject live mode.
4. Open Test settings; select Live, the connected agent ID, and the opted-in number. Affirm authorization. Click Run test once.
5. Inspect the Bolna node's provider execution ID. Wait for the real call to end, then click **Refresh call** in the debugger. No automatic duplicate outbound call is made.
6. Confirm the persisted transcript matches the provider record. Missing tool traces must appear as not evaluated. The caller may exercise a chosen scenario manually; Sentinel does not inject the synthetic caller into a phone call.
7. Use the provider's cancellation UI if necessary. Sentinel's local stop button cannot promise cancellation of an already dispatched hosted call.

See [VERIFICATION.md](VERIFICATION.md) for exactly which live paths were exercised. Setup and automated checks never place calls or update hosted prompts. Provider errors intentionally omit upstream payloads and credentials.

## Controlled synthetic tool endpoint

`POST /api/tools/execute` requires `X-Tool-Token` matching `TOOL_ENDPOINT_TOKEN`. The trusted synthetic subject comes from `TOOL_SUBJECT_ID`, never from caller-supplied claims. Send a supported tool, account ID, supplied subject/verified fields (non-authoritative), and a unique idempotency key. An unauthorized account returns HTTP 403 with a blocked decision. These are fictional tools, not a real payment or CRM integration.

## Callback gateway

`POST /api/webhooks/bolna` accepts JSON with `event_id` and `execution_id`. A trusted gateway computes a lowercase hex HMAC-SHA256 of the exact request bytes using `WEBHOOK_SECRET`, placed in `X-Sentinel-Signature`. The backend deduplicates event IDs and fetches execution status from Bolna rather than trusting callback transcript contents.

This is Sentinel's gateway contract. Direct Bolna callbacks are not claimed to have this signature format. Use explicit polling until a secure gateway is configured and tested.

## Retention

In the UI, delete recordings and completed/failed/cancelled/interrupted runs explicitly. Removing a recording removes its raw audio and transcript record; previously captured run evidence remains until those runs are deleted. For offline maintenance, stop the server and run from `services/api` using the same data-directory configuration:

```sh
uv run python ../../scripts/retention.py --days 30
# Review the counts, then apply deliberately:
uv run python ../../scripts/retention.py --days 30 --apply
```

This is manual maintenance, not a scheduled deletion service. Backups and encryption are deployment responsibilities.
