#!/usr/bin/env bash
# Run both processes; if either exits, stop the container so the Space restarts it.
set -euo pipefail
cd /app/api && uv run --no-sync uvicorn sentinel.main:app --host 127.0.0.1 --port 8001 --workers 1 &
cd /app/web && node node_modules/next/dist/bin/next start apps/web --hostname 0.0.0.0 --port 7860 &
wait -n
exit 1
