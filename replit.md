# SmartBearing

India's first dual-modal edge intelligence system for spindle bearing failure prediction in power loom MSMEs — a corporate-grade IoT dashboard for predictive bearing failure monitoring in textile factories.

## Run & Operate

- `pnpm --filter @workspace/smartbearing run dev` — run the SmartBearing frontend (Vite, port assigned by workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + wouter routing
- Charts: Recharts
- 3D: @react-three/fiber + @react-three/drei (with CSS fallback when WebGL unavailable)
- Animation: Framer Motion
- Icons: Lucide React
- Styling: Tailwind CSS v4 + shadcn/ui
- API: Express 5 (no DB used — all mock data)

## Where things live

- `artifacts/smartbearing/src/pages/` — all 9 pages (Landing, Login, Register, Dashboard, MachineDetail, Predictions, Alerts, Analytics, Settings)
- `artifacts/smartbearing/src/data/mockData.ts` — all mock sensor/machine/alert data
- `artifacts/smartbearing/src/components/landing/BearingModel.tsx` — 3D/CSS bearing component
- `artifacts/smartbearing/src/components/layout/DashLayout.tsx` — sidebar + topbar layout for all dashboard pages
- `artifacts/smartbearing/src/index.css` — full dark navy theme (CSS variables, custom utilities)
- `artifacts/smartbearing/index.html` — sets `class="dark"` on `<html>`

## Architecture decisions

- All data is mock/hardcoded — no backend calls from the SmartBearing frontend (future API integration ready)
- Auth is localStorage-based (key: `isLoggedIn`) — suitable for demo/MVP; upgrade to real auth when needed
- 3D bearing uses a CSS animated fallback when WebGL is unavailable (e.g., Replit preview environment)
- Routing uses `wouter` (not react-router-dom) — already in workspace catalog
- Dark theme is enforced via `class="dark"` on `<html>` — not a toggle

## Product

SmartBearing monitors spindle bearing health in textile MSME factories (power looms). It:
- Collects vibration + acoustic signals from edge sensor nodes
- Runs Isolation Forest anomaly detection on-device
- Displays real-time bearing health scores, FFT analysis, and BPFO detection
- Predicts remaining useful life (RUL) and estimated time to failure
- Sends WhatsApp alerts before failure occurs

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Tailwind v4: `@apply dark` is invalid (dark is a variant, not a utility) — use `class="dark"` on `<html>` element instead
- Google Fonts `@import url(...)` must be the VERY FIRST line of `index.css` — before `@import "tailwindcss"`
- CSS variables use space-separated HSL values (no `hsl()` wrapper) — usage: `hsl(var(--primary))`
- Do NOT run `pnpm dev` at workspace root — use workflow or `pnpm --filter @workspace/<slug> run dev`
- WebGL not available in Replit screenshot/preview sandbox — BearingModel detects this and falls back to CSS animation

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
