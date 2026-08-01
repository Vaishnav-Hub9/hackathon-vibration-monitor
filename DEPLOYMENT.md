# Deployment — SmartBearing (hackathon-vibration-monitor)

This repo is wired for **permanent, auto-updating** hosting:

| Piece | Platform | What deploys |
|---|---|---|
| Frontend (React/Vite app) | **Vercel** | `artifacts/smartbearing` |
| API server (Express + Socket.io + MongoDB) | **Render** | `artifacts/api-server` (via `render.yaml`) |
| ML predictor (FastAPI + XGBoost) | **Render** | `artifacts/api-server/src/ml` (via `render.yaml`) |

Every push to `main` automatically redeploys **all three** — no manual steps after setup.

---

## 1) Render — API + ML (do this first, you need the URL for Vercel)

1. Push this repo to GitHub (already done for `Vaishnav-Hub9/hackathon-vibration-monitor`).
2. Create a **free MongoDB Atlas** cluster (M0) and copy the connection string
   (`mongodb+srv://user:pass@cluster.../smartbearing`). Whitelist `0.0.0.0/0`.
3. Go to **https://dashboard.render.com** → **New** → **Blueprint** → pick this GitHub repo.
4. Render reads `render.yaml` and creates **two services**:
   - `smartbearing-api` (Node) — needs `MONGODB_URI` filled in.
   - `smartbearing-ml` (Python) — auto-wired to the API via `ML_SERVER_URL`.
5. On the API service → **Environment** → add `MONGODB_URI` = your Atlas string.
6. Both services deploy automatically. Note the API URL:
   `https://smartbearing-api.onrender.com` (that's what Vercel needs below).

> First deploy takes a few minutes (pip + pnpm install). The ML service loads the
> committed `.pkl` models — no extra artifacts needed.

---

## 2) Vercel — Frontend

1. Go to **https://vercel.com** → **Add New** → **Project** → import
   `Vaishnav-Hub9/hackathon-vibration-monitor`.
2. Settings:
   - **Root Directory:** `artifacts/smartbearing`
   - Framework preset: **Vite** (auto-detected via `vercel.json`)
   - Install command: `pnpm install --frozen-lockfile` (from `vercel.json` — pnpm is required because the app uses `workspace:*` packages)
   - Build command: `pnpm run build` (from `vercel.json`)
   - Output directory: `dist/public` (from `vercel.json`)
3. **Environment Variables** (Project → Settings → Environment Variables):
   - `VITE_API_URL` = `https://smartbearing-api.onrender.com`
4. Click **Deploy**. Every push to `main` auto-rebuilds the frontend.

---

## 3) Env vars recap

| Where | Key | Example |
|---|---|---|
| Render (API) | `MONGODB_URI` | `mongodb+srv://…/smartbearing` |
| Render (API) | `SIMULATOR_AUTO_START` | `true` (set in `render.yaml`) |
| Render (API) | `ML_SERVER_URL` | auto from blueprint |
| Render (API) | `PORT` | `5000` (set in `render.yaml`) |
| Render (ML) | `OPENAI_API_KEY` | optional — technician summaries fall back to mock text |
| Vercel | `VITE_API_URL` | `https://smartbearing-api.onrender.com` |

---

## Local equivalents

```bash
# API
cd artifacts/api-server && pnpm install && pnpm build && MONGODB_URI=… pnpm start

# ML server (separate terminal)
cd artifacts/api-server/src/ml && pip install -r requirements.txt && uvicorn server:app --port 8000

# Frontend
cd artifacts/smartbearing && pnpm install && VITE_API_URL=http://localhost:5000 pnpm dev
```

Demo credentials: `admin@smartbearing.com / Admin@123` · `operator@smartbearing.com / Operator@123`
