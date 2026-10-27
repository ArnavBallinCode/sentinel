#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
VERIFY_DATA=$(mktemp -d "${TMPDIR:-/tmp}/sentinel-verify.XXXXXX")
VERIFY_API_PORT=${VERIFY_API_PORT:-8013}
VERIFY_WEB_PORT=${VERIFY_WEB_PORT:-3013}
node scripts/local-server.mjs check "$VERIFY_API_PORT" "$VERIFY_WEB_PORT"
# Keep all verification, including imports during pytest, away from working state.
unset DATABASE_URL
unset RENDER SENTINEL_REQUIRE_AUTH SENTINEL_WEB_USERNAME SENTINEL_WEB_PASSWORD API_HOSTPORT NEXT_PUBLIC_BASE_PATH
export SENTINEL_DATA_DIR="$VERIFY_DATA"
export BOLNA_API_KEY= GROQ_API_KEY= OPENAI_API_KEY= SENTINEL_API_TOKEN=
export WEBHOOK_SECRET= TOOL_ENDPOINT_TOKEN= ALLOWED_TEST_NUMBERS= MAX_LIVE_CALLS_PER_DAY=0
export ALLOWED_ORIGINS="http://127.0.0.1:$VERIFY_WEB_PORT"
printf 'Isolated verification logs: %s\n' "$VERIFY_DATA"
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
uv run --directory services/api pytest -q
npm run typecheck
API_URL="http://127.0.0.1:$VERIFY_API_PORT" NEXT_DIST_DIR=.next-verify npm run build
uv run --directory services/api uvicorn sentinel.main:app --host 127.0.0.1 --port "$VERIFY_API_PORT" >"$VERIFY_DATA/api.log" 2>&1 &
api_pid=$!
API_URL="http://127.0.0.1:$VERIFY_API_PORT" NEXT_DIST_DIR=.next-verify node node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 --port "$VERIFY_WEB_PORT" >"$VERIFY_DATA/web.log" 2>&1 &
web_pid=$!
node scripts/local-server.mjs wait "$api_pid" "http://127.0.0.1:$VERIFY_API_PORT/api/health"
node scripts/local-server.mjs wait "$web_pid" "http://127.0.0.1:$VERIFY_WEB_PORT/api/health"
E2E_BASE_URL="http://127.0.0.1:$VERIFY_WEB_PORT" npm run test:e2e
kill "$web_pid" "$api_pid"
wait "$web_pid" 2>/dev/null || true
wait "$api_pid" 2>/dev/null || true
export NEXT_PUBLIC_BASE_PATH=/sentinel
API_URL="http://127.0.0.1:$VERIFY_API_PORT" NEXT_DIST_DIR=.next-verify npm run build
export SENTINEL_API_TOKEN=synthetic-internal-token-for-hosted-tests-only
export SENTINEL_REQUIRE_AUTH=true SENTINEL_WEB_USERNAME=sentinel-test
export SENTINEL_WEB_PASSWORD=synthetic-hosted-password-for-tests-only
uv run --directory services/api uvicorn sentinel.main:app --host 127.0.0.1 --port "$VERIFY_API_PORT" >>"$VERIFY_DATA/api.log" 2>&1 &
api_pid=$!
API_URL="http://127.0.0.1:$VERIFY_API_PORT" NEXT_DIST_DIR=.next-verify node node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 --port "$VERIFY_WEB_PORT" >>"$VERIFY_DATA/web.log" 2>&1 &
web_pid=$!
node scripts/local-server.mjs wait "$web_pid" "http://127.0.0.1:$VERIFY_WEB_PORT/sentinel/api/health"
E2E_BASE_URL="http://127.0.0.1:$VERIFY_WEB_PORT" E2E_API_URL="http://127.0.0.1:$VERIFY_API_PORT" E2E_BASE_PATH=/sentinel npx playwright test --config playwright.hosted.config.ts
# A broken secret configuration must close access, even to an otherwise valid login.
kill "$web_pid"
wait "$web_pid" 2>/dev/null || true
unset SENTINEL_WEB_PASSWORD
API_URL="http://127.0.0.1:$VERIFY_API_PORT" NEXT_DIST_DIR=.next-verify node node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 --port "$VERIFY_WEB_PORT" >>"$VERIFY_DATA/web.log" 2>&1 &
web_pid=$!
node scripts/local-server.mjs wait "$web_pid" "http://127.0.0.1:$VERIFY_WEB_PORT/sentinel/api/health"
VERIFY_WEB_PORT="$VERIFY_WEB_PORT" node -e 'fetch(`http://127.0.0.1:${process.env.VERIFY_WEB_PORT}/sentinel/api/runs`).then(r => { if(r.status !== 503) throw Error("Missing hosted credentials did not fail closed"); console.log("Missing hosted credentials fail closed."); })'
printf 'Verification passed. Isolated logs: %s\n' "$VERIFY_DATA"
