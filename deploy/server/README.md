# Hosting Sentinel on the VoxBento host

Two modes share one container, one port (`127.0.0.1:3100`) and one Caddy route (`/sentinel`). Run `docker compose` from this directory.

## Public judge demo (`docker-compose.public.yml`)

Anonymous, bring-your-own-keys. Judges run the full product (stress test, harden and retest, release checks, workflow trace, call audits) with their own Groq/OpenAI key and, optionally, their own Bolna key.

- The server holds no provider keys; startup fails if any are present (`public_demo.py`). Keys arrive as request headers, live only in that request's context (`keyring.py`) and are never stored or logged.
- Each browser gets a random session id. Its runs, workflows, recordings and imports are stored under that session (`store.py`) and are invisible to others; seeded data and links by run id stay readable.
- Phone calls (no server-side number allowlist), pushing guardrails to a hosted agent, rollbacks, webhooks and the server tool endpoint are closed (`public_demo.allowed_request`).
- Its data lives in the `sentinel-public-data` volume at `/app/data/public-demo`.

    docker compose -f docker-compose.public.yml up -d --build

## Private workspace (`docker-compose.yml`)

Password-protected, with Bolna and Groq keys from `deploy/server/.env`. Its evidence stays in the `sentinel-data` volume, which switching modes does not delete.

    docker compose -f docker-compose.yml up -d --build

Switching replaces the running container, so only one mode is served at a time.
