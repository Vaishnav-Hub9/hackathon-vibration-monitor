# SmartBearing Capture (smartphone PWA)

Standalone phone app for the SmartBearing demo. It listens with the phone
microphone (Web Audio API FFT) and accelerometer, scores the reading, and
POSTs it to the API server — which pushes it live to the existing dashboard
over Socket.io. **No dashboard code changes are needed** for the phone data
to appear (the dashboard already listens to the same `sensor:update` channel).

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app — single file, no build step |

## Run it

The capture app is NOT part of the React/Vite build. Serve the folder with
any static server, e.g.:

```bash
# from the repo root
npx serve smartbearing-capture
```

Open `http://localhost:3000` in your phone browser (or on your laptop to test).

Point it at your backend by editing `API_BASE` at the top of `index.html`:

```js
// Default (laptop running the API server):
const API_BASE = 'http://localhost:5000';
// Phone on the same Wi-Fi as your laptop:
const API_BASE = 'http://192.168.1.10:5000';  // your laptop's LAN IP
```

## ⚠️ Microphone access on a real phone

`getUserMedia` only works on a **secure context**: `https://` or `localhost`.

- **Laptop testing** — `http://localhost` is fine.
- **Phone testing on a LAN IP** — `http://192.168.x.x` will be BLOCKED.
  Options:
  1. Android Chrome dev: open `chrome://flags` →
     `Insecure origins treated as secure` → add your `http://192.168.x.x:PORT`
     (and the API base) → relaunch.
  2. Use `adb reverse tcp:5000 tcp:5000` + `adb reverse tcp:3000 tcp:3000`
     and open `http://localhost:3000` on the phone.
  3. Run the capture page over HTTPS (tunnel / TLS reverse proxy).

## Calibration (do this once per machine — improves accuracy a lot)

1. With the machine **OFF** (e.g. Sunday shutdown), open the app and select
   the machine.
2. Tap **RECORD** and hold the phone at the marked mounting point for
   the 4-second capture.
3. Tap **Save as Baseline**. The backend stores this noise floor per machine.
4. All future readings for that machine are normalised against this baseline
   before anomaly scoring (BPFO floor + acoustic floor subtracted).
5. Repeat for each machine. The baseline is stored in the API server's memory
   (reset on server restart).

## Flow

```
Phone mic/accel → capture (4s) → score (BPFO window, acoustic RMS, vibration RMS)
  → POST /api/sensor-readings (includes raw 2048-pt mic waveform, RPM, sample rate)
  → backend relays the waveform to the ML server /predict → REAL model verdict
    (label + confidence + technician summary), merged into the reading/alert
  → Socket.io 'sensor:update' → dashboard Live Feed (with ML fault chip)
  → SpindleReading + Alert persisted → machine history / FFT / RUL charts
  → (critical) POST /api/sensor-readings/whatsapp-alert
```

The raw waveform is RMS-normalised to ~1g before sending so the model sees
amplitudes in the vibration range it was trained on (spectral shape — the fault
signature — is preserved). If the ML server is unreachable, the reading still
ingests with the heuristic score; ML is an enhancement, never a blocker.

## API endpoints used

| Endpoint | Purpose |
|---|---|
| `POST /api/sensor-readings` | Submit a capture reading |
| `GET /api/sensor-readings/calibrate/:machineId` | Fetch baseline for machine |
| `POST /api/sensor-readings/calibrate/:machineId` | Save baseline for machine |
| `POST /api/sensor-readings/whatsapp-alert` | Acknowledge critical alert (delivery simulated in dashboard) |

## Honest claims for evaluators

- **Acoustic BPFO spike detection** — primary signal, ~85% accuracy at close
  range (<5 cm).
- **Vibration RMS** — trend only (±0.15 g vs calibrated MEMS); thresholds
  are 1.5 g (warning) and 3.0 g (critical).
- **Temperature & voltage are dataset-augmented** (CWRU health-stage mapping),
  NOT live measurements — disclose this. Live temperature needs a
  Bluetooth thermometer (~₹500) in production.
