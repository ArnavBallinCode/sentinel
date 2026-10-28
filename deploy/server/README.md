# Hosting Sentinel on the VoxBento host

Two modes share one container, one port (`127.0.0.1:3100`) and one Caddy route (`/sentinel`). Run `docker compose` from this directory.

## Public judge demo (`docker-compose.public.yml`)

Anonymous, synthetic, provider-free. Judges can run the scripted release check and inspect runs, evidence and workflow traces.

- No provider keys are passed to the container; startup fails if any are present (`public_demo.py`).
- Its own data lives in the `sentinel-public-data` volume at `/app/data/public-demo`.
- The API allows only a small set of reads, plus `POST /api/campaigns` (scripted fixtures, default guardrails, at most 100 stored checks) and `POST /api/validate`. Calls, uploads, prompt edits and provider actions return 403.

    docker compose -f docker-compose.public.yml up -d --build

## Private workspace (`docker-compose.yml`)

Password-protected, with Bolna and Groq keys from `deploy/server/.env`. Its evidence stays in the `sentinel-data` volume, which switching modes does not delete.

    docker compose -f docker-compose.yml up -d --build

Switching replaces the running container, so only one mode is served at a time.
