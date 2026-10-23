# Startup, live verification and deployment

## Local start

Use `scripts/dev.sh` from the repository. It installs missing JavaScript dependencies, syncs the locked Python environment, optionally reads the root `.env`, and runs the API on loopback port 8000 plus Next.js on 3000. On restart, saved graphs, runs and events survive. Waiting provider executions can be refreshed; uncertain running calls become interrupted and must be inspected in the provider dashboard before another dispatch.

Use one API worker. Shared or public hosting is intentionally outside this local MVP's authentication/tenant model. Docker Compose is provided with loopback-bound ports and a named data volume. Both images built, Compose configuration validated, and isolated containers passed a proxied API regression test.

## Hosted Bolna checklist

1. Configure a valid `BOLNA_API_KEY`, `ALLOWED_TEST_NUMBERS` containing an explicitly opted-in E.164 number, and the default low daily call limit. Restart the backend.
2. Open Settings; enter a real agent ID and choose **Verify & connect agent**. Record the successful metadata response without exposing credentials.
3. Select **Voice agent workflow**. The adversarial template includes a simulation-only caller and will correctly reject live mode.
4. Open Test settings; select Live, the connected agent ID, and the opted-in number. Affirm authorization. Click Run test once.
5. Inspect the Bolna node's provider execution ID. Wait for the real call to end, then click **Refresh call** in the debugger. No automatic duplicate outbound call is made.
6. Confirm the persisted transcript matches the provider record. Missing tool traces must appear as not evaluated. The caller may exercise a chosen scenario manually; Sentinel does not inject the synthetic caller into a phone call.
7. Use the provider's cancellation UI if necessary. Sentinel's local stop button cannot promise cancellation of an already dispatched hosted call.

No live call was performed in this delivery. Provider errors intentionally omit upstream payloads and credentials.

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
