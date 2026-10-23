#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
VERIFY_DATA=$(mktemp -d "${TMPDIR:-/tmp}/sentinel-verify.XXXXXX")
VERIFY_API_PORT=${VERIFY_API_PORT:-8013}
VERIFY_WEB_PORT=${VERIFY_WEB_PORT:-3013}
api_pid=""
web_pid=""
cleanup() {
  if [[ -n "$web_pid" ]]; then kill "$web_pid" 2>/dev/null || true; fi
  if [[ -n "$api_pid" ]]; then kill "$api_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM
uv run --directory services/api pytest -q
npm run typecheck
NEXT_DIST_DIR=.next-build npm run build
SENTINEL_DATA_DIR="$VERIFY_DATA" BOLNA_API_KEY= GROQ_API_KEY= OPENAI_API_KEY= SENTINEL_API_TOKEN= ALLOWED_ORIGINS="http://127.0.0.1:$VERIFY_WEB_PORT" env -u DATABASE_URL uv run --directory services/api uvicorn sentinel.main:app --host 127.0.0.1 --port "$VERIFY_API_PORT" >"$VERIFY_DATA/api.log" 2>&1 &
api_pid=$!
API_URL="http://127.0.0.1:$VERIFY_API_PORT" NEXT_DIST_DIR=.next-e2e node node_modules/next/dist/bin/next dev apps/web --hostname 127.0.0.1 --port "$VERIFY_WEB_PORT" >"$VERIFY_DATA/web.log" 2>&1 &
web_pid=$!
VERIFY_API_PORT="$VERIFY_API_PORT" VERIFY_WEB_PORT="$VERIFY_WEB_PORT" node <<'JS'
(async()=>{for(const port of [process.env.VERIFY_API_PORT,process.env.VERIFY_WEB_PORT]){let ready=false;for(let i=0;i<120;i++){try{const r=await fetch(`http://127.0.0.1:${port}/`+(port===process.env.VERIFY_API_PORT?'api/health':''));if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}if(!ready)throw Error('Verification server failed to start on '+port)}})().catch(e=>{console.error(e);process.exit(1)})
JS
E2E_BASE_URL="http://127.0.0.1:$VERIFY_WEB_PORT" npm run test:e2e
printf 'Verification passed. Isolated logs: %s\n' "$VERIFY_DATA"
