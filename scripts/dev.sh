#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${1:-}" != "" && "${1:-}" != "--offline" ]]; then
  printf 'Usage: bash scripts/dev.sh [--offline]\n' >&2
  exit 1
fi
for dependency in node npm uv; do
  if ! command -v "$dependency" >/dev/null 2>&1; then
    printf 'Missing %s. See README.md for setup requirements.\n' "$dependency" >&2
    exit 1
  fi
done
DEV_API_PORT=${DEV_API_PORT:-8001}
DEV_WEB_PORT=${DEV_WEB_PORT:-3000}
node scripts/local-server.mjs check "$DEV_API_PORT" "$DEV_WEB_PORT"
if [[ ! -d node_modules ]]; then npm ci; fi
uv sync --directory services/api --frozen
args=(--host 127.0.0.1 --port "$DEV_API_PORT")
if [[ "${1:-}" == "--offline" ]]; then
  # Never inherit provider access or a working database into the reviewer demo.
  unset DATABASE_URL
  unset RENDER SENTINEL_REQUIRE_AUTH SENTINEL_WEB_USERNAME SENTINEL_WEB_PASSWORD API_HOSTPORT
  export BOLNA_API_KEY= OPENAI_API_KEY= GROQ_API_KEY= SENTINEL_API_TOKEN=
  export WEBHOOK_SECRET= TOOL_ENDPOINT_TOKEN= ALLOWED_TEST_NUMBERS= MAX_LIVE_CALLS_PER_DAY=0
  export SENTINEL_DATA_DIR="$(pwd)/artifacts/reviewer-data"
  export ALLOWED_ORIGINS="http://127.0.0.1:$DEV_WEB_PORT,http://localhost:$DEV_WEB_PORT"
  export NEXT_DIST_DIR=.next-demo
  printf 'Offline rehearsal: provider access disabled; state in artifacts/reviewer-data.\n'
elif [[ -f .env ]]; then
  args+=(--env-file "$(pwd)/.env")
fi
api_pid=""
web_pid=""
cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$web_pid" ]]; then kill "$web_pid" 2>/dev/null || true; fi
  if [[ -n "$api_pid" ]]; then kill "$api_pid" 2>/dev/null || true; fi
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
uv run --directory services/api uvicorn sentinel.main:app "${args[@]}" &
api_pid=$!
node scripts/local-server.mjs wait "$api_pid" "http://127.0.0.1:$DEV_API_PORT/api/health"
printf '\nSentinel Studio: http://127.0.0.1:%s/demo\nPress Ctrl+C to stop both services.\n\n' "$DEV_WEB_PORT"
API_URL="http://127.0.0.1:$DEV_API_PORT" node node_modules/next/dist/bin/next dev apps/web --hostname 127.0.0.1 --port "$DEV_WEB_PORT" &
web_pid=$!
wait "$web_pid"
