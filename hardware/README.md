# SmartBearing Hardware Lab — Arduino + Python Predictive Maintenance Rig

A physical IoT rig that mirrors what the SmartBearing dashboard does digitally:
a DC motor instrumented with an IR tachometer and a DS18B20 temperature probe,
whose stream is turned into real-time fault predictions by a Python ML
pipeline and forwarded to the dashboard's **Hardware Lab** page.

```
┌─────────────┐  JSON @9600 baud, 1 line/s   ┌──────────────────────┐
│ Arduino Uno │ ───────────────────────────► │ hardware/main.py     │
│  + L298N    │   {"rpm":1440.0,             │ serial ingestion     │
│  + LM393    │    "temperature":28.5,       │ 30 s window features │
│  + DS18B20  │    "motorSpeed":150}         │ IsolationForest      │
└─────────────┘                              │ verdict + CSV log    │
                                             └──────────┬───────────┘
                                                        │ POST /api/hardware/ingest
                                                        ▼
                                        SmartBearing dashboard → Hardware Lab
                                        (live RPM/temp curves, health index)
```

## 1. Bill of materials

| Part | Qty | Notes |
|---|---|---|
| Arduino Uno R3 | 1 | |
| L298N motor driver module | 1 | 12 V external supply |
| DC motor | 1 | 6–12 V |
| IR optical tachometer module (LM393) | 1 | slotted disc / reflective flag on the shaft |
| DS18B20 temperature sensor (3-wire) | 1 | waterproof probe or breakout |
| 12 V DC power supply | 1 | for the motor side |
| Jumper wires | ~15 | |

## 2. Wiring (pin map)

| Component | Pin | Arduino pin |
|---|---|---|
| L298N | ENA (enable/PWM) | **D9** |
| L298N | IN1 | **D10** |
| L298N | IN2 | **D11** |
| L298N | OUT1 / OUT2 | DC motor terminals |
| L298N | +12 V | 12 V supply **+** |
| L298N | GND | shared ground: 12 V **−** **and** Arduino GND |
| L298N | +5 V terminal | powers the DS18B20 (regulator output) |
| LM393 tach | VCC | Arduino 5 V |
| LM393 tach | GND | Arduino GND |
| LM393 tach | OUT | **D2** (hardware interrupt INT0) |
| DS18B20 | + (VCC) | L298N +5 V terminal |
| DS18B20 | − (GND) | L298N GND (common with Arduino) |
| DS18B20 | OUT / S (data) | **D5** |

> ⚠️ **Grounding matters.** The 12 V supply GND, the L298N GND, and the
> Arduino GND must all be tied together — the tachometer and temperature
> sensor reference the Arduino's 5 V rail, while the motor switches 12 V.

> 🛠️ **No breadboard? Wire the DS18B20 straight to the Arduino.** The L298N's
> `+5 V` terminal only outputs power while the 12 V rail is connected AND its
> 5 V-enable jumper is fitted — so for reliability, power the probe from the
> Arduino instead: red→**5V**, black→**GND**, yellow/white→**D5**. If the probe is
> bare (no breakout board), twist a **4.7 kΩ resistor** between the DATA and
> VCC wires (solder or tape it) — waterproof probes usually have this pull-up
> built into the cable boot already.

## 3. Flash the firmware

Open `motor_monitor.ino` in the Arduino IDE (or `arduino-cli`), install
**OneWire** and **DallasTemperature** via the Library Manager, select the Uno,
and upload.

Firmware behaviour (matches the spec):
- Hardware interrupt on **D2 / INT0, `FALLING` edge** — one counter bump per
  shutter gap, no polling jitter.
- DS18B20 read on **D5** with fail-safe handling: invalid reads (`-127.00`,
  `-999.00`, NaN, out of physical range) emit `"temperature": null` instead of
  corrupting the stream.
- Motor driven at **PWM 150** on D9, direction HIGH on D10 / LOW on D11.
- Non-blocking `millis()` loop emits exactly one JSON line per second at
  9600 baud: `{"rpm": 1440.0, "temperature": 28.5, "motorSpeed": 150}`.
  `RPM = pulses × 60.0` (1 s window, one pulse per revolution). If your tach
  disc has *N* slots per revolution, divide by *N* in the sketch.

## 3b. Wiring self-test (find connection faults in ~10 s)

Not sure a sensor is actually connected? Flash the diagnostic sketch:

```bash
# from hardware/  (or open wiring_test/wiring_test.ino in the Arduino IDE)
arduino-cli upload -p /dev/cu.usbmodem101 --fqbn arduino:avr:uno wiring_test
```

Open the Serial Monitor at 9600 baud. It drives the motor driver, counts
**5 s of live tach pulses**, scans the **OneWire bus** for the DS18B20 (reporting
its ROM address), and prints a PASS/FAIL verdict per subsystem with the exact
wiring to check. Type `r` + Enter to re-run, `0` to park — then flash
`motor_monitor` again to return to live mode.

## 4. Run the Python pipeline

```bash
cd hardware
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python main.py            # auto-detect the Arduino port (ttyACM*/ttyUSB*/COM*)
python main.py --port COM3      # or pin the port explicitly
python main.py --demo           # no Arduino plugged in? synthesize a stream
```

What happens on first run:
1. The port is auto-detected; JSON lines are parsed defensively (corrupt
   frames are skipped, never fatal).
2. A **30 s rolling window** accumulates samples, computing `rpm_mean`,
   `rpm_std`, `temp_mean`, `temp_rate_of_change` (°C/s slope) and
   `rpm_temp_ratio` every second.
3. With no `model.pkl` yet, the first 30 s of "normal" running are recorded as
   a **calibration baseline** and an `IsolationForest` is fitted and saved —
   the model learns what *your* rig looks like when healthy.
4. From then on every sample is scored by the **dual anomaly engine**:
   - *Hard safety thresholds* — temperature > 60 °C **or** a sudden RPM drop
     > 30 % → immediate `BEARING FAULT / SEVERE`.
   - *IsolationForest health index* → HEALTHY (green) / WARNING / IMBALANCE
     (orange) / BEARING FAULT / SEVERE (red).
5. A live `rich` console dashboard updates every second; every sample is
   appended to `predictive_maintenance_log.csv`.

## 5. Stream to the dashboard (Hardware Lab page)

The pipeline forwards each sample to the SmartBearing API on every tick:

```bash
# defaults: SB_API_URL=http://localhost:5001/api/hardware/ingest
python main.py --port /dev/ttyACM0
```

The dashboard's **Hardware Lab** page (sidebar → Hardware Lab) then shows the
rig live: RPM + temperature curves, the health-index verdict, and the 30 s
feature statistics, updated over WebSocket within ~1 s of each reading. No
Arduino connected? The API runs a built-in simulator so the page is always
live — the page labels the source (`Arduino` vs `Simulator`) so it's never
misleading.

- `SB_API_URL` — override the ingest endpoint (default `http://localhost:5001/api/hardware/ingest`).
- `SB_API_TOKEN` — dashboard JWT if the endpoint ever requires auth.
- `--no-dashboard` — run the pipeline purely local (CSV + console only).

## 6. Files

| File | Purpose |
|---|---|
| `motor_monitor/motor_monitor.ino` | Arduino firmware (interrupt tach, DS18B20, PWM motor, 1 Hz JSON) |
| `wiring_test/wiring_test.ino` | Diagnostic sketch — OneWire scan + 5 s tach pulse count + PASS/FAIL report |
| `main.py` | Serial ingestion, 30 s feature window, dual anomaly engine, dashboard, CSV |
| `requirements.txt` | Python dependencies |
| `predictive_maintenance_log.csv` | Created at runtime — one row per second |
| `model.pkl` | Created at runtime — the calibrated IsolationForest baseline |
