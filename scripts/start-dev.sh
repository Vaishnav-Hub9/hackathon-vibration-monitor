#!/bin/sh
# Freebuff preview entrypoint: boots the FULL SmartBearing stack —
#   1. in-memory MongoDB (:27017) + one-time DB seed
#   2. Node API server + sensor simulator (:5000)
#   3. Python ML server (:8000)
#   4. Vite dashboard (:5173, foreground/managed)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  [ -n "$MONGO_PID" ] && kill "$MONGO_PID" 2>/dev/null || true
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "$ML_PID" ] && kill "$ML_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── 1. In-memory MongoDB ──────────────────────────────────────────────
node "$ROOT/artifacts/api-server/scripts/start-mongo.mjs" > /tmp/sb-mongo.log 2>&1 &
MONGO_PID=$!

# Wait for the URI line (mongod binary may download on first run)
MONGODB_URI=""
i=0
while [ $i -lt 120 ]; do
  MONGODB_URI=$(grep -o 'mongodb://127\.0\.0\.1:[0-9]*/smartbearing[?]*' /tmp/sb-mongo.log | head -1)
  [ -n "$MONGODB_URI" ] && break
  sleep 1
  i=$((i + 1))
done
if [ -z "$MONGODB_URI" ]; then
  echo "[start-dev] MongoDB failed to start:" >&2
  cat /tmp/sb-mongo.log >&2
  exit 1
fi
echo "[start-dev] MongoDB: $MONGODB_URI"

export MONGODB_URI

# ── 2. API server (+ simulator auto-start) ────────────────────────────
# NOTE: pin PORT=5000 — Freebuff injects PORT=5173 for the dashboard, and the
# API server must not inherit it.
cd "$ROOT/artifacts/api-server"
PORT=5000 SIMULATOR_AUTO_START=true npx tsx src/index.ts > /tmp/sb-api.log 2>&1 &
API_PID=$!

# Seed once the API is accepting connections (seed script is idempotent-ish:
# it inserts demo data; tolerate failures so the dashboard still loads)
sleep 4
SIMULATOR_AUTO_START=false PORT=5000 npx tsx src/scripts/seed.ts > /tmp/sb-seed.log 2>&1 || \
  echo "[start-dev] seed failed (non-fatal); see /tmp/sb-seed.log"

# ── 3. ML server ──────────────────────────────────────────────────────
ML_DIR="$ROOT/artifacts/api-server/src/ml"
python3 -c "import fastapi, uvicorn, sklearn, joblib" 2>/dev/null || \
  pip3 install -q -r "$ML_DIR/requirements.txt"
uvicorn server:app --host 127.0.0.1 --port 8000 --app-dir "$ML_DIR" > /tmp/sb-ml.log 2>&1 &
ML_PID=$!

# ── 4. Dashboard (foreground — managed preview process) ──────────────
cd "$ROOT/artifacts/smartbearing"

# Wait for port 5173 to be free (a previous preview instance may still be
# releasing it during restart). Probe with node — /dev/tcp is dash-unavailable.
free_wait=0
while [ $free_wait -lt 45 ]; do
  if node -e "const s=require('net').createServer();s.once('error',()=>process.exit(1));s.listen(5173,'0.0.0.0',()=>s.close(()=>process.exit(0)))" 2>/dev/null; then
    break
  fi
  sleep 1
  free_wait=$((free_wait + 1))
done

# Launch vite; if it hits EADDRINUSE despite the wait (restart race), retry.
attempt=0
while true; do
  pnpm run dev
  code=$?
  attempt=$((attempt + 1))
  if [ $attempt -ge 8 ]; then
    echo "[start-dev] dashboard failed after $attempt attempts (last exit $code)" >&2
    exit $code
  fi
  echo "[start-dev] dashboard exited ($code) — retrying in 3s" >&2
  sleep 3
  # Re-check port before relaunching
  while ! node -e "const s=require('net').createServer();s.once('error',()=>process.exit(1));s.listen(5173,'0.0.0.0',()=>s.close(()=>process.exit(0)))" 2>/dev/null; do
    sleep 1
  done
done
