# SmartBearing Hackathon Demo — Runbook

**Goal:** show the full pipeline live in ~7 minutes — a bearing fault is
injected, the **real trained ML model** classifies it and the dashboard
highlights it, then a **smartphone capture** sends a real mic reading that
lands on the same dashboard with its own ML verdict.

**Stack used in this demo:** dashboard (Vite) on `:5173`, API server on `:5001`
(5000 is often occupied), ML server on `127.0.0.1:8000`, MongoDB
(`smartbearing_preview` DB, seeded). Full start-up steps are in
[`.freebuff/run.md`](.freebuff/run.md); capture-app setup is in
[`smartbearing-capture/README.md`](smartbearing-capture/README.md).

---

## 0. Pre-flight checklist (do this before the judges arrive)

- [ ] `pnpm` deps installed (`npx -y pnpm@10 install --frozen-lockfile`)
- [ ] DB seeded: `MONGODB_URI=mongodb://localhost:27017/smartbearing_preview npx -y pnpm@10 --filter @workspace/api-server run seed`
- [ ] ML server up on `:8000` → verify `curl http://localhost:5001/api/health/ml` returns `"online": true`
- [ ] API server up on `:5001` (simulator ON) → `curl http://localhost:5001/api/machines` returns 401
- [ ] Dashboard up on `:5173` → `curl http://localhost:5173/` returns 200
- [ ] Capture app served (laptop browser test): `npx serve smartbearing-capture`
- [ ] **Phone ready** (see §5 / capture README): mic access needs HTTPS or `localhost`
  — on Android Chrome use `chrome://flags` → *Insecure origins treated as secure* →
  add `http://<laptop-IP>:<port>`, or use `adb reverse`. Point `API_BASE` in
  `smartbearing-capture/index.html` at your laptop's LAN IP (e.g. `http://192.168.1.10:5001`).
- [ ] Both demo screens visible: dashboard on the big screen, phone in your hand.

**Login:** `admin@smartbearing.com` / `Admin@123` (seeded). On the login page you
must **type** the email (the visible text is only a hint), then the password.

---

## 1. Act — Landing page (~30 s)

Open `http://localhost:5173/`.

| You | Say |
|---|---|
| Let the WebGL bearing render, hover the hero stats | "This is SmartBearing — ₹1,800 edge nodes that hear a bearing failing before it seizes." |
| Click **Spin On** / **Explode** briefly | "Live telemetry on the left — spindle RPM, housing temperature, vibration RMS." |
| Scroll to the WhatsApp alert card | "When the model detects a fault, the foreman's WhatsApp buzzes with an estimated time-to-failure." |

## 2. Act — Sign in (~15 s)

Click **Log In** → type `admin@smartbearing.com`, `Admin@123` → **Sign In**.
You land on **Fleet Overview**.

> **Say:** "This is the live dashboard — every number on screen is streaming
> from the sensor simulator through the real ML model, over Socket.io."

## 3. Act — Live baseline (~45 s)

Point at, in order:

1. **KPI row** — Fleet Risk Assessment %, Active Alerts, Downtime Prevented.
2. **Live Sensor Feed** — *"these six nodes update every 3.5 seconds"*. Call out the
   **ML fault chips** on the cards: M003 shows **OUTER RACE**, M002 shows **IMBALANCE**.
   *"Those are the trained model's verdicts on the live vibration stream — not mock data."*
3. **Machine Status grid** — Ring Frame #3 CRITICAL (38%), Ring Frame #2 WARNING.
4. **Recent Alerts** — one shows *"Outer Race detected via smartphone with 100.0% confidence."*
   *"That one came from the phone — we'll do that live in a minute."*

## 4. Act — Fault Injector: fault in, verdict out (~60 s)

The Fault Injector panel targets **Ring Frame #1 (M001)**, currently healthy.

1. **Click `Outer Race`** (last button in the grid).
   *"I just told the backend to give M001 an outer-race defect. The simulator now
   streams the matching BPFO signature into the trained model."*
2. **Wait one 3.5 s cycle.** Watch for:
   - the strip flips to **`ML VERDICT: OUTER RACE`** (+ confidence %),
   - the green line **"Model confirmed Outer Race — highlighted in the CAD model."**
     appears under the panel,
   - the M001 card in Machine Status turns **CRITICAL** (refresh the page if it
     doesn't — that grid loads on mount).
3. **Click `Imbalance`** (optional, shows it's not a one-trick) — verdict flips to IMBALANCE.
4. **Restore: click `Healthy`.** Wait one cycle → verdict returns to **Healthy**.

> **Say:** "Inject a fault → the model hears it and names it. This is the whole
> product: detect, classify, recommend — before 400 spindles go dark."

## 5. Act — Smartphone capture: phone → ML verdict → dashboard (~2 min)

**On the phone** (`smartbearing-capture/index.html`, served from your laptop):

1. Select machine (default **Ring Frame #3 / M003** is fine) and node.
2. Tap **RECORD**, hold the phone against the bearing housing (or speaker playing
   bearing audio) for the 4-second capture. Watch the **FFT bars** and the orange
   **BPFO marker** line.
3. After capture, readings show: Vibration RMS (g), Acoustic Score, BPFO peak, Anomaly Score.
   Tap **Send to Dashboard →**.
4. **On the phone, watch the status bar:** `✅ Reading sent … · ML verdict: <LABEL> (<conf>%)` —
   the backend relayed the raw mic waveform to the ML server and the real model scored it.

**On the dashboard (big screen), within ~1 second:**

1. The **Live Sensor Feed** updates with the phone's node/value (it may roll off
   after a few seconds — the feed shows the 6 most recently updated nodes).
2. If the reading crosses the critical/warning threshold, **Recent Alerts**
   prepends a new alert instantly (e.g. *"Outer Race detected via smartphone with
   100.0% confidence."*). Alerts are **deduped per node** — to guarantee a fresh
   alert, capture on a node with no active alert (e.g. **Ring Frame #4 / M004**).
   A critical phone reading on a node with an active *warning* alert **escalates**
   it to critical (old alert resolved, new one created).
3. **Active Alerts** KPI increments when a new alert lands.

> **Say:** "No Bluetooth, no gateway — just the phone's mic, Web Audio FFT, and
> the same trained model the edge nodes use. The reading is stored as a real
> sensor record: it shows up in machine history, the FFT chart, and RUL."

## 6. Act — The alert, with evidence (~30 s)

Click **Alerts** in the sidebar.

1. Find the newest CRITICAL alert. It carries the **🧠 AI Technician Assessment**
   (e.g. *"High spectral energy in the BPFO range … Recommended Action: Schedule
   bearing replacement within 18 hours."*).
2. Click **View Evidence** — defect frequencies (BPFO/BPFI/BSF), FFT peaks,
   RMS/kurtosis/crest factor.
3. Click **Acknowledge** to show the workflow.

> **Say:** "Every alert is an evidence pack — not just a red dot. The technician
> sees the fault, the confidence, and the recommended action."

## 7. Act — Close (30 s)

- Summarize: *"Edge nodes + smartphone capture → real ML classification →
  WhatsApp/dashboard alerts with evidence and time-to-failure."*
- **Disclose honestly** (evaluators respect this):
  - Temperature and voltage are **dataset-augmented** (CWRU health-stage mapping),
    not live measurements — live temperature needs a ~₹500 Bluetooth thermometer.
  - The phone hears *airborne* bearing sound; the model was trained on vibration,
    so the verdict depends on placement — the calibration procedure
    (noise-floor baseline per machine) and a fixed mounting point are what make it accurate.
  - Simulated faults are real ML predictions on synthesized signatures — the same
    DSP/model code path the edge node uses.

---

## Quick-reference: exact click order

```
Landing → Log In → admin@smartbearing.com / Admin@123 → Sign In
Dashboard:
  Fault Injector → Outer Race → [wait 1 cycle] → Healthy
Phone (capture app):
  RECORD → [4 s] → Send to Dashboard →
Dashboard:
  Alerts → newest alert → View Evidence → Acknowledge
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| "ML model offline" banner on dashboard | ML server down → start it (run.md §2); it auto-clears within one simulator cycle |
| Phone mic denied / "cannot start" | Not a secure context → HTTPS or `localhost`, or Android `chrome://flags` insecure-origins |
| Reading sent but dashboard doesn't react | `API_BASE` on the phone must point at the laptop's LAN IP **and** port 5001 |
| No new alert in Recent Alerts after send | Alert dedup: same machine+node already has an active alert at that severity → pick a fresh node or a healthy machine |
| Dashboard stuck showing mock values | The dashboard only receives machine-room broadcasts after subscribing — reload the page if the socket reconnected |
| Fault Injector verdict flickers | Fixed in the current build (verdict is pinned); if you still see it, hard-refresh to drop the stale bundle |
