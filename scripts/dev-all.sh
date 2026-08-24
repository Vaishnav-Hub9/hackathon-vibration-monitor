#!/bin/sh
# dev-all.sh — start the full SmartBearing stack for the Freebuff preview.
# Startup order matters: the frontend (Vite, on the preview port) binds FIRST
# so Freebuff's port detection routes to it; then mongo, ML server and API.
#   1. Frontend (Vite dev server on $FRONTEND_PORT, proxies /api + /socket.io)
#   2. in-memory MongoDB (mongodb-memory-server-core, port 27017)
#   3. Python ML server (FastAPI/uvicorn, port 8000)
#   4. Node API server (Express + simulator, port 5000) — seeded
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Freebuff's preview URL routes to a detected listening port and re-injects it
# as $PORT on later starts. Keep the frontend above the backend ports.
FRONTEND_PORT="${PORT:-32123}"
if [ "$FRONTEND_PORT" -lt 9000 ] 2>/dev/null; then
  FRONTEND_PORT=32123
fi

cleanup() {
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[dev-all] starting frontend (Vite :$FRONTEND_PORT) first so port detection finds it..."
cd "$ROOT/artifacts/smartbearing"
npx vite --config vite.config.ts --host 0.0.0.0 --port "$FRONTEND_PORT" --strictPort &
VITE_PID=$!

i=0
while [ $i -lt 60 ]; do
  if node -e "fetch('http://127.0.0.1:${FRONTEND_PORT}/').then(r=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  i=$((i+1))
  sleep 1
done
[ $i -lt 60 ] && echo "[dev-all] frontend ready" || echo "[dev-all] WARNING: frontend not ready yet" >&2

cd "$ROOT"

echo "[dev-all] starting in-memory MongoDB..."
MONGO_LOG="$ROOT/.dev-mongo.log"
node "$ROOT/artifacts/api-server/scripts/start-mongo.mjs" >"$MONGO_LOG" 2>&1 &
MONGO_PID=$!

MONGODB_URI=""
i=0
while [ $i -lt 60 ]; do
  if grep -q '^MONGODB_URI=' "$MONGO_LOG" 2>/dev/null; then
    MONGODB_URI=$(grep '^MONGODB_URI=' "$MONGO_LOG" | head -1 | cut -d= -f2-)
    break
  fi
  i=$((i+1))
  sleep 1
done
if [ -z "$MONGODB_URI" ]; then
  echo "[dev-all] ERROR: MongoDB did not become ready" >&2
  cat "$MONGO_LOG" >&2 || true
  exit 1
fi
echo "[dev-all] MongoDB ready: $MONGODB_URI"

ML_PORT="${ML_PORT:-8000}"
echo "[dev-all] starting ML server (uvicorn :$ML_PORT)..."
ML_DIR="$ROOT/artifacts/api-server/src/ml"
PY="$ML_DIR/.venv/bin/python"
if [ ! -x "$PY" ]; then PY="$(command -v python3)"; fi
(cd "$ML_DIR" && exec "$PY" -m uvicorn server:app --host 127.0.0.1 --port "$ML_PORT") &
ML_PID=$!

i=0
while [ $i -lt 60 ]; do
  if node -e "fetch('http://127.0.0.1:${ML_PORT}/docs').then(r=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  i=$((i+1))
  sleep 1
done
if [ $i -ge 60 ]; then
  echo "[dev-all] WARNING: ML server not reachable yet; continuing (API has fallbacks)." >&2
else
  echo "[dev-all] ML server ready"
fi

echo "[dev-all] seeding database..."
(cd "$ROOT/artifacts/api-server" && MONGODB_URI="$MONGODB_URI" npx tsx src/scripts/seed.ts) || echo "[dev-all] seed failed (continuing)"

echo "[dev-all] starting API server (:5000)..."
(cd "$ROOT/artifacts/api-server" \
  && MONGODB_URI="$MONGODB_URI" \
     PORT=5000 \
     ML_SERVER_URL="http://127.0.0.1:$ML_PORT" \
     SIMULATOR_AUTO_START=true \
     exec npx tsx src/index.ts) &
API_PID=$!

i=0
while [ $i -lt 90 ]; do
  if node -e "fetch('http://127.0.0.1:5000/api/healthz').then(r=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  i=$((i+1))
  sleep 1
done
[ $i -lt 90 ] && echo "[dev-all] API ready — full SmartBearing stack is up" || echo "[dev-all] WARNING: API not ready yet" >&2

wait
