#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -d node_modules ]]; then npm ci; fi
uv sync --directory services/api --frozen
args=()
if [[ -f .env ]]; then args=(--env-file "$(pwd)/.env"); fi
uv run --directory services/api uvicorn sentinel.main:app --host 127.0.0.1 --port 8001 "${args[@]}" &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT INT TERM
npm run dev
