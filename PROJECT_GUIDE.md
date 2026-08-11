# 🛠️ SmartBearing — The Complete Project Guide

**Rotating Machinery Condition Monitoring · Hackathon Problem Statement 08**

*This is the one file to read to understand the whole project — where it came from,
what every piece does, how the analysis works, the physics, the machine learning,
and a page-by-page walkthrough. Plain language first, formulas where they matter.*

> Companion docs: [`README.md`](README.md) (problem-statement compliance matrix) ·
> [`DEMO.md`](DEMO.md) (exact demo click-order and talking points) ·
> [`CONCEPTS.md`](CONCEPTS.md) (deep physics + architecture narrative).

---

## Table of Contents

1. [Project History](#1-project-history)
2. [What Each Part Does](#2-what-each-part-does)
3. [How the Analysis Is Done](#3-how-the-analysis-is-done)
4. [The Complete Physics](#4-the-complete-physics)
5. [The Complete Machine Learning](#5-the-complete-machine-learning)
6. [Complete Walkthrough](#6-complete-walkthrough)
7. [Key Terminology Decoded](#7-key-terminology-decoded)

---

## 1. Project History

### The problem that started it
The project began as a hackathon response to **Problem Statement 08: Rotating
Machinery Condition Monitoring (Vibration FFT + Risk)**. A textile mill's **ring
frame** is a machine with ~400 spindles; each spindle spins at **12,000–15,000 RPM**
(200–250 turns per second) on a **ball bearing** about the size of a large marble.
When a bearing fails at that speed it can seize the spindle, snap thread, and stop
all 400 spindles at once — hours of downtime and tens of thousands of rupees per
incident. The insight the whole project is built on:

> **Bearings give warning signs before they die — tiny vibration and sound changes —
> and a machine can be taught to read those signs and raise the alarm early.**

### The honest-data pivot
Early versions of the dashboard showed simulated numbers everywhere (fake health
scores, random predictions). A major pivot replaced every fake number with **real
computation**: a Python ML server with an actual trained scikit-learn classifier,
a Node.js backend that persists every reading to MongoDB, and a React dashboard
that streams live inference over Socket.io. If the ML server is offline, the UI
says so instead of faking predictions.

### How the data problem was solved
Real labeled bearing-failure recordings don't exist for a student team. The project
solved this **legitimately and transparently**: the training data is *synthesized
from the physics itself*. Every fault class has a known spectral signature
(BPFO/BPFI/BSF formulas — see §4), so the trainer writes those signatures into fake
vibration windows and the classifier learns to recognize them. The synthetic data
is the physics written as numbers, and the docs say exactly that.

### Feature history (this session's additions)
- **Smartphone capture PWA** (`smartbearing-capture/`): a phone mic → Web Audio FFT →
  raw spectrum POSTed to the backend → real ML verdict, plus an accelerometer
  "vibration" capture mode (with an honest note about its sample-rate limit).
- **Manual Test Bench** on the Pipeline page: sliders for acoustic / vibration /
  electrical values → a 2048-point signal synthesized with the *same recipe the model
  was trained on* → real inference → live dashboard alert.
- **Analytics overhaul**: 1-year ball-bearing degradation trend (vibration vs.
  temperature, degradation phases, statistical summary) anchored on real stored
  readings.
- **ML Training Analysis page** (`/ml-analysis`): confusion matrix, per-class
  precision/recall/F1, training vs. validation loss curves, feature scatter, PCA —
  all computed live from the actual trained model on a held-out set.
- **Dynamic alerts badge** in the sidebar (real active-alert count, hidden at 0).

---

## 2. What Each Part Does

```
┌─────────────────── SOURCES ───────────────────┐
│ 1. Edge Simulator (Node)  → 2. Phone PWA      │
│ 3. Fault Injector (demo)  → 4. Manual Test    │
│                               Bench (UI)      │
└───────────────┬───────────────────────────────┘
                ▼ 2048-point vibration window + telemetry
┌────────────────────────────────────────────────┐
│ Node.js API server (Express, port 5001)        │
│  • auth (JWT) · machines · alerts · analytics  │
│  • proxies signals to the ML server            │
│  • persists readings to MongoDB                │
│  • raises alerts with an evidence pack         │
│  • pushes live updates over Socket.io          │
└───────────────┬───────────────────────────────┘
                ▼ signal (2048 floats) + rpm
┌────────────────────────────────────────────────┐
│ Python ML server (FastAPI, port 8000)          │
│  • extracts 29 physics features                │
│  • GradientBoosting 6-class predict_proba      │
│  • returns label, confidence, probabilities,   │
│    defect frequencies, technician summary      │
└───────────────┬───────────────────────────────┘
                ▼ verdicts + readings + alerts
┌────────────────────────────────────────────────┐
│ React dashboard (Vite, port 5173)              │
│  Dashboard · Machines · Predictions · Alerts   │
│  Analytics · ML Analysis · Digital Twin ·      │
│  Pipeline (auto-sim + test bench) · Settings   │
└────────────────────────────────────────────────┘
```

### The four data sources
1. **Edge Simulator** (`artifacts/api-server/src/simulator/`): every ~3.5 s builds a
   physically-plausible vibration signal for each spindle node, sends it through the
   same ML `/predict` endpoint the phone uses, and streams readings + alerts. This is
   what keeps the dashboard "alive" without hardware.
2. **Smartphone PWA** (`smartbearing-capture/`): a standalone capture app. It records
   audio, computes the FFT in the browser, and POSTs the raw spectrum (plus an
   optional accelerometer signal) to `/api/sensor-readings`, which relays it to the
   ML server. Phone readings appear on the dashboard as their own feed entries.
3. **Fault Injector** (Dashboard widget): picks a machine and a fault class and tells
   the simulator to emit that fault's signature — for demoing "a fault just happened".
4. **Manual Test Bench** (Pipeline page): full manual control — acoustic level, RMS,
   fault class, severity, RPM, voltage, temperature. It synthesizes the 2048-point
   window client-side (a TypeScript mirror of the training script) and pushes it
   through the real relay.

### The Node.js API server (`artifacts/api-server/`)
- **`src/routes/`** — Express routers: `auth` (JWT login/register), `machines`
  (list + history + FFT + RUL projections), `alerts` (list/acknowledge/resolve with
  evidence), `analytics` (summary, 30-day trends, heatmap, monthly alerts, ROI,
  **bearing-trend**), `sensor-readings` (the ingest relay), `simulator` (start/stop/
  inject-fault), `ml` (proxies the ML training analysis), `health`, `maintenance`,
  `sensors`.
- **`src/models/`** — Mongoose schemas: `Machine`, `SpindleReading` (every reading:
  accel x/y/z, rpm, FFT, temperature, health, ML label/confidence, waveform),
  `Alert` (with the **evidence pack**), `User`.
- **`src/simulator/`** — `SensorSimulator.ts` + `ingest.ts` (synthesis + the same
  ML relay path).
- **`src/ml/`** — the Python ML side lives here: `features.py` (shared feature +
  defect-frequency math), `train_model.py` (trains the classifier), `server.py`
  (FastAPI `/predict` + `/analysis`).

### The Python ML server (`artifacts/api-server/src/ml/server.py`)
- `POST /predict` — takes a 2048-point signal + rpm, extracts features, runs the
  classifier, returns label / confidence / full probability vector / defect
  frequencies / technician summary. Handles degenerate (flat/empty) signals
  gracefully with a low-confidence Healthy verdict instead of a 500.
- `GET /analysis` — recomputes the training diagnostics live from the trained
  pickles: confusion matrix, per-class metrics, loss curves, feature scatter, PCA.

### The React dashboard (`artifacts/smartbearing/`)
- **Pages**: Landing (3D bearing hero), Login/Register, Dashboard (live sensor feed,
  Fleet Copilot, Fault Injector, WhatsApp card), Machine Detail, Predictions (RUL
  trajectories), Alerts (with expandable evidence), Analytics, **ML Analysis**,
  Digital Twin (3D model), Pipeline (3D telemetry flow + test bench), Settings.
- **Live plumbing**: `lib/socket.ts` (one Socket.io connection), `hooks/useLiveSensors`
  (per-machine live feed), `lib/api.ts` (authenticated axios client).

---

## 3. How the Analysis Is Done

The pipeline, step by step, with the real numbers:

1. **Capture.** A vibration signal is captured as **2048 samples** (about half a
   second at the model's 4,000 Hz rate). Source: simulator, phone, or test bench.
2. **FFT.** The signal is transformed from *time domain* (amplitude vs. sample) to
   *frequency domain* (energy vs. Hz). With 2048 samples at 4,000 Hz, each FFT
   **bin** is `4000 / 2048 ≈ 1.95 Hz` wide, and the spectrum is valid up to the
   Nyquist limit of 2,000 Hz.
3. **29 features.** From each window the code computes (see `features.py`):
   - *Time-domain:* mean, std, variance, **RMS** (energy level), peak-to-peak,
     **kurtosis** (how "spiky" the signal is), **skewness**, **crest factor**,
     shape/impulse/margin factors.
   - *Frequency-domain:* FFT mean/std/max, spectral entropy, spectral centroid,
     dominant frequency.
   - ***The discriminative ones:* band-energy ratios** — what fraction of total
     spectral energy sits in the **1×/2× RPM**, **BPFO**, **BPFI**, **BSF**, and
     **FTF** bands (each with up to 3 harmonics). A defective bearing dumps energy
     into its defect band; a healthy one doesn't.
4. **Classify.** The GradientBoosting classifier (220 shallow trees, depth 4) scores
   the 29-feature vector and returns a probability for each of the six classes:
   **Healthy, Imbalance, Misalignment, Ball, Inner Race, Outer Race**.
5. **Verdict + action.** The highest-probability class becomes the label; its
   probability becomes the confidence. The server composes a **technician summary**
   (AI-generated when a key is set, otherwise a realistic deterministic summary) with
   a recommended inspection action.
6. **Persist + alert.** The backend stores the reading, and if the verdict is a
   fault above the dedup window, it raises an **alert** carrying an **evidence pack**:
   the label, confidence, dominant frequency, FFT peaks, key features, and defect
   frequencies — so an engineer can see *why* the machine was flagged.
7. **Deliver.** Everything streams to the dashboard over Socket.io (`reading:new`,
   `alert:new`, `fleet:summary`), and the WhatsApp simulation card can notify the
   foreman.
8. **Act.** The dashboard surfaces the alert in the live feed, notification bell,
   alerts center, and Fleet Copilot ("Why did M003 alert?").

### How the analytics are computed
- **Live KPIs** (machines, uptime, alerts today, avg health) — real aggregations over
  the stored readings/alerts collections.
- **Bearing degradation trend** (`/api/analytics/bearing-trend`) — the *latest real
  measured* vibration/temperature/health anchor the end of a 1-month / 6-month /
  1-year curve; the pre-history is projected backward with a deterministic wear model
  (fixed seed, documented in code), with three degradation phases and statistics
  (moving average, std, kurtosis, peak-to-peak, RUL decay rate, degradation index).
- **RUL projections** (`/api/machines/:id/rul`) — linear least-squares regression over
  the *real stored health history*, clamped to a sane decay band.
- **ML analysis** (`/api/ml/analysis`) — the trained pickles are re-scored on a fresh
  2,400-sample held-out set; every chart is computed, not mocked.

---

## 4. The Complete Physics

### What a bearing is
A ball bearing is two rings (an **inner race** pressed on the spinning shaft, an
**outer race** fixed in the housing) with steel **balls** rolling between them so
metal doesn't rub metal. This project uses a **6205 deep-groove ball bearing**:
9 balls, ball diameter **7.94 mm**, pitch diameter **39.04 mm**, contact angle 0°.

### The "playing card in the spokes" idea
When a defect forms (a pit, a flake, a spall), every ball that rolls over it drops in
and bounces out — an **impact pulse** repeated at a fixed rate, like a playing card
clicking on bicycle spokes. That repeat rate is a *frequency*, and it's different
depending on **where** the defect is:

| Defect location | Rate formula | Why |
|---|---|---|
| **BPFO** — outer race | `(N/2)·fᵣ·(1 − (d/D)·cos α)` | The pit is stationary; each of the N balls passes it once per revolution |
| **BPFI** — inner race | `(N/2)·fᵣ·(1 + (d/D)·cos α)` | The pit spins with the shaft, so the balls hit it *faster* |
| **BSF** — ball element | `(D/2d)·fᵣ·(1 − ((d/D)·cos α)²)` | The defect is on the ball itself — it touches both races per roll |
| **FTF** — cage/train | `(fᵣ/2)·(1 − (d/D)·cos α)` | The whole ball train orbits slowly |
| **1× / 2× RPM** | `fᵣ` = RPM/60 | A heavy spot (imbalance) whips the shaft once per rev; a bent shaft (misalignment) strains it twice |

where `N` = ball count, `D` = pitch diameter, `d` = ball diameter, `α` = contact
angle, `fᵣ` = RPM ÷ 60 (turns per second).

### Worked example — 15,000 RPM
`fᵣ = 15000/60 = 250 Hz`. With the 6205 geometry:

- **BPFO** = 4.5 × 250 × (1 − 7.94/39.04) = 4.5 × 250 × 0.7966 ≈ **896 Hz**
- **BPFI** = 4.5 × 250 × 1.2034 ≈ **1,354 Hz**
- **BSF** = (39.04/15.88) × 250 × 0.9586 ≈ **589 Hz**
- **FTF** = 125 × 0.7966 ≈ **100 Hz**

The model's defect-frequency bands are computed from exactly these formulas at the
live RPM — training and inference always agree.

### Sampling, FFT, Nyquist
- A **sample rate** is how many times per second the signal is measured. The model
  was trained at **4,000 Hz**; the phone mic records at **44,100 Hz**.
- The **Nyquist limit** says a sample rate of *R* can only represent frequencies up
  to *R/2*. At 4 kHz the model sees up to 2 kHz — comfortably covering BPFO
  (896 Hz) and its first harmonic (1,792 Hz); the 3rd harmonic (2.7 kHz) is aliased
  away, which is expected and honest.
- The **FFT** converts the time-domain window into frequency bins. For 2048 samples
  at 4 kHz: bin width = 4000/2048 ≈ **1.95 Hz**. A fault tone at 896 Hz lands in bin
  460. The phone's display uses its own bigger window (4096 pts @ 44.1 kHz →
  10.77 Hz bins) — same idea, finer display.

### What the features physically mean
- **RMS (root mean square)** — the "energy meter" of vibration. It grows as a
  bearing wears because impacts add power across the spectrum.
- **Kurtosis** — how heavy the signal's *tails* are. Impact pulses are rare, violent
  spikes → **high kurtosis**. This is the classic bearing-health indicator.
- **Crest factor** — peak ÷ RMS; also spikes upward for impacts.
- **Band-energy ratios** — the fraction of total spectral energy inside each defect
  band. A healthy bearing spreads energy flatly; a faulty one concentrates it at its
  defect frequency (and harmonics). This is the feature the classifier keys on.

### The degradation story
Bearings don't fail instantly. The analytics page plots the classic phases:
**Baseline Operation** (flat vibration, stable temperature) → **Early Micro-cracking**
(sub-surface fatigue starts, tiny spalls form, temperature drifts up) → **Accelerated
Wear** (the spall grows, RMS climbs steeply, temperature follows) → failure. The
whole predictive-maintenance premise is catching the middle phases while there is
still a maintenance window.

---

## 5. The Complete Machine Learning

### The data problem
Real labeled bearing-failure datasets are rare. The project synthesizes training
data from physics (`train_model.py`): each of the six classes has a *recipe*, and
every sample starts from broadband noise plus a small 1× RPM fundamental (every real
machine has one — the classifier must learn that "1× present" alone isn't a fault).

| Class | Recipe addition (the physics in code) |
|---|---|
| Healthy | nothing more — just noise + the normal heartbeat |
| Imbalance | strong 1× (1.6×), small 2× (0.15×) — one heavy spot, one thump per turn |
| Misalignment | mid 1× (0.5×), strong 2× (1.8×), some 4× (0.3×) — shaft strained twice per turn |
| Outer Race | BPFO + 2·BPFO + 3·BPFO with 1/h amplitude decay — repeated impact pulse rings |
| Inner Race | same structure at BPFI — faster click rate on the spinning race |
| Ball | same structure at BSF — the ball hits both races |

Training set: **700 samples/class × 6 = 4,200 windows**, RPM randomized 13,500–
16,500, severity 0.7–1.3, 25% held out for validation.

### The model
- **Algorithm:** `GradientBoostingClassifier` — an ensemble of 220 small decision
  trees (depth 4), learning rate 0.08. Each tree learns to correct the mistakes of
  the previous ones, minimizing log loss (deviance).
- **Input:** the 29 physics features from §3 (a 29-dimensional vector per window).
- **Output:** a probability for all six classes (`predict_proba`); the argmax is the
  label, the max probability is the confidence. Faults are reported
  **probabilistically**, as the problem statement requires.

### How we know it works (the `/ml-analysis` page)
The trained pickles are re-scored on a fresh held-out set, and *everything is
computed live*:
- **Confusion matrix** (6×6): rows = true class, columns = predicted. The diagonal
  dominates — the model separates inner-race from outer-race faults with essentially
  zero false positives.
- **Precision / recall / F1 per class**: all ≈ 1.0 on the synthesized validation
  set, including the Healthy class.
- **Loss curves**: training and validation deviance both fall steeply in the first
  ~50 trees and plateau together — the classic no-overfitting signature.
- **Feature scatter (RMS vs. kurtosis)**: healthy windows cluster at low RMS,
  near-Gaussian kurtosis; impact faults separate by high kurtosis.
- **PCA projection**: the 29 features, standardized and compressed to 2 components,
  show each class as a distinct lobe with Healthy forming a tight core.

### Honest limitations (the page says this too)
The validation set comes from the *same physics recipes* the model was trained on,
so in-domain accuracy is ~100%. Real factory signals are messier — background noise,
other machines, phone microphones hearing airborne sound instead of direct
vibration. Field accuracy depends on the noise-floor baseline and consistent sensor
placement. The demo therefore validates the model on physically-correct synthesized
streams, and the docs never claim otherwise.

---

## 6. Complete Walkthrough

### 6.0 Starting the stack
See `.freebuff/run.md` for the exact commands. In short: MongoDB (27017) → ML server
(FastAPI, 127.0.0.1:8000, sklearn 1.8.0 venv) → API server (Express, port **5001**,
simulator auto-start) → dashboard (Vite, port **5173**). Login:
`admin@smartbearing.com` / `Admin@123`.

### 6.1 Landing page (`/`)
A 3D bearing hero with the pitch ("Hear the bearing before it breaks"), key stats,
and a WhatsApp-simulator card. Click **Explore** → login.

### 6.2 Dashboard (`/dashboard`)
The command center:
- **Live Sensor Feed** — chips per node streaming real ML verdicts over Socket.io
  (e.g., `OUTER RACE · M003 · CRITICAL`), with confidence and freshness.
- **Fault Injector** — pick a machine + fault → the simulator emits that signature →
  watch the feed, alert strip, and Recent Alerts react in seconds.
- **Fleet Copilot** ("Ask Your Fleet") — six quick prompts (highest risk machine,
  why did M003 alert, fleet health, savings, top fault seen, how detection works)
  answered from live data.
- **Recent Alerts, machine cards, RUL, history, FFT** — all real.

### 6.3 Machines (`/machine/M003`)
Per-machine detail: live accel x/y/z, temperature, RPM, the FFT spectrum with
BPFO/BPFI/BSF reference lines, waveform, 24 h trends, RUL projection, and the node
risk table.

### 6.4 Predictions (`/predictions`)
Highest-risk machine, trending-worse machine, cost at risk, **RUL trajectories**
(historical solid + projected dashed against the failure threshold), and a node risk
ranking table.

### 6.5 Alerts (`/alerts`)
Every alert with severity, evidence, and **View Evidence** — expands the full
evidence pack (label, confidence, dominant frequency, FFT peaks, RMS/kurtosis/crest,
defect frequencies). Acknowledge/resolve from the row.

### 6.6 Analytics (`/analytics`)
Top: the **Bearing Degradation Trend** — time-horizon selector (1M/6M/1Y), machine
filter, four KPI cards, the dual-axis vibration-vs-temperature chart with phase
bands, and the statistical summary + auto-generated wear narrative. Below: live
fleet KPIs, 30-day fleet health, alert heatmap, monthly alert/prevention bars,
machine health table, and the ROI calculator.

### 6.7 ML Analysis (`/ml-analysis`)
The model's report card: metadata strip (name, trained date, dataset, accuracy, F1,
loss, model spec), feature-correlation scatter, PCA anomaly space, loss curves,
per-class metrics bars, the heatmap-style confusion matrix, and an educational card
under every chart. If the ML server is off, the page says so instead of faking it.

### 6.8 Digital Twin (`/twin`) & Pipeline (`/workflow`)
- **Digital Twin**: the interactive 3D bearing.
- **Pipeline**: the telemetry flow as a 3D conveyor (Acoustic → Thermal →
  Vibration+Electrical → ML → Dashboard).
  - **Run Auto-Sim** sweeps the sweep through all five stages; it completes, shows
    "Payload Dispatched", auto-dismisses, and the **Replay** button is always
    available — the page never locks up.
  - **Manual Test Bench**: tune acoustic / vibration (fault class, severity, RPM) /
    electrical (voltage, temperature), press **Synthesize & Run ML Test** — the 3D
    stage sweeps again, now **animated to your parameter intensities** (louder
    acoustic → denser/faster sound particles; hotter temperature → faster heat
    rings; higher RMS/severity → faster spindle shake and brighter ML core), and the
    real ML verdict appears with per-class probabilities. Between runs the stage
    keeps animating at the current bench intensity.

### 6.9 Smartphone capture PWA (`smartbearing-capture/`)
Open the capture app on a phone (same network), pick a machine, **Record** — the mic
stream's raw FFT spectrum is POSTed to `/api/sensor-readings`, relayed to the ML
server, and the verdict lands on the dashboard feed and Alerts. The **vibration**
mode buffers accelerometer samples into a 2048-point signal with an honest note
about the ~60–100 Hz sample-rate limit (that's why the mic is the primary mode).

### 6.10 The demo loop (5 minutes)
1. Open the dashboard — live feed streaming real ML verdicts.
2. **Fault Injector** → inject "Outer Race" on M003 → watch the feed flip to
   OUTER RACE and a CRITICAL alert appear in seconds.
3. Open **Alerts** → **View Evidence** on the new alert → show the evidence pack.
4. Open **Analytics** → 1-Year bearing trend → narrate the degradation phases.
5. Open **ML Analysis** → confusion matrix → "no inner/outer confusion".
6. Open **Pipeline** → Run Auto-Sim, then run the Manual Test Bench with Inner
   Race @ high severity → verdict + live dashboard alert.
7. Ask the **Fleet Copilot** "Why did M003 alert?" for the AI summary.

---

## 7. Key Terminology Decoded

| Term | Plain-English meaning |
|---|---|
| **RPM / Hz** | Revolutions per minute / cycles per second. 15,000 RPM = 250 Hz = 250 turns per second. |
| **Sample rate** | How many measurements per second. 4 kHz (model) / 44.1 kHz (phone mic). |
| **Window** | The slice of signal analyzed at once — 2048 samples ≈ 0.5 s here. |
| **FFT** | Fast Fourier Transform — decomposes a signal into its frequencies; turns a wiggly line into a bar chart of "energy at each frequency". |
| **Bin** | One frequency "bucket" of the FFT; bin width = sample rate ÷ window size (≈1.95 Hz at 4 kHz/2048). |
| **Nyquist limit** | The highest frequency a sample rate can represent: half the rate (2 kHz at 4 kHz sampling). |
| **Harmonic** | A frequency that is a whole-number multiple of a base frequency (2×, 3×). Impact pulses ring at their fundamental *and* quieter harmonics. |
| **BPFO / BPFI / BSF / FTF** | Ball Pass Frequency Outer/Inner race, Ball Spin Frequency, Fundamental Train Frequency — the signature click-rates of defects in each bearing component (see §4). |
| **1× / 2× RPM** | Energy at the turning speed / twice it — the signatures of imbalance / misalignment. |
| **RMS** | Root mean square — the vibration "energy meter". |
| **Kurtosis** | How spiky a signal is; impact pulses make it large. |
| **Crest factor** | Peak ÷ RMS — another impact detector. |
| **Feature** | A single measurable property of the signal (RMS, kurtosis, band energy…); the model sees 29 per window. |
| **Class / classifier** | One of the six fault categories / the algorithm that assigns a window to a class. |
| **Gradient boosting** | An ensemble that adds small trees one at a time, each fixing its predecessors' errors. |
| **predict_proba / confidence** | The model's probability per class / the probability of the chosen class. |
| **Precision / Recall / F1** | Of the things predicted as fault X, how many were right (precision); of the actual fault X cases, how many were caught (recall); their harmonic mean (F1). |
| **Confusion matrix** | A grid of true-vs-predicted counts; diagonal = correct, off-diagonal = mistakes. |
| **PCA** | Principal Component Analysis — compresses 29 features into 2 viewable dimensions while keeping maximum spread. |
| **Overfitting** | When a model memorizes training data and fails on new data; here the loss curves show it doesn't. |
| **Anomaly score** | A 0–1 severity of "something is wrong" derived from the verdict/severity. |
| **Health / risk score** | 0–100 composite; low = risky. |
| **RUL** | Remaining Useful Life — projected days until the failure threshold, from regression on real history. |
| **Degradation index** | 0–100 wear composite used on the analytics trend. |
| **Evidence pack** | Everything that explains an alert: label, confidence, FFT peaks, key features, defect frequencies. |
| **Dedup** | Repeating alerts for the same machine+node are suppressed so the feed isn't flooded. |
| **Socket.io** | The live push channel — readings and alerts arrive without refreshing. |
| **JWT** | The login token that authorizes API calls. |
| **Relay / proxy** | The API server forwarding the raw signal to the Python ML server and returning the verdict. |
| **Edge node / spindle** | An individual monitored bearing location (e.g., SN003 on M003). |
| **Degenerate signal** | Flat/empty/non-finite input — handled with a low-confidence Healthy verdict, never a crash. |

---

*Questions or gaps? The three companion docs — `DEMO.md`, `CONCEPTS.md`, `README.md` —
go deeper on the demo script, the physics narrative, and the compliance matrix.*
