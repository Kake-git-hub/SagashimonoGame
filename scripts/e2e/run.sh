#!/usr/bin/env bash
# 使い方: bash scripts/e2e/run.sh <neji-smoke|stage-shots|pwa-update|home-smoke>
set -u
cd "$(dirname "$0")/../.."
name="${1:-neji-smoke}"
script="scripts/e2e/$name.cjs"
if [ ! -f "$script" ]; then echo "unknown script: $name"; exit 2; fi
mkdir -p scripts/e2e/out
export E2E_PORT="${E2E_PORT:-4173}"
export E2E_OUT="$(pwd)/scripts/e2e/out"

npm run build >/dev/null 2>&1 || { echo "build failed"; npm run build; exit 1; }
npx vite preview --port "$E2E_PORT" --strictPort >/dev/null 2>&1 &
server=$!
for _ in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$E2E_PORT/SagashimonoGame/" && break; sleep 0.5; done
node "$script"
status=$?
kill "$server" 2>/dev/null; wait "$server" 2>/dev/null
fuser -k "$E2E_PORT/tcp" >/dev/null 2>&1 || true
exit $status
