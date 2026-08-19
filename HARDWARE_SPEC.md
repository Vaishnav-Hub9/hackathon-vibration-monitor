# 🛠️ SmartBearing IoT Predictive Maintenance — Complete Hardware Specification

**Version:** 1.0 · **Date:** August 2026  
**Purpose:** Full hardware requirements for Tinkercad/Tinkered.ai 3D simulation  
**System:** Arduino Uno R3 + L298N Motor Driver + DC Motor + IR Tachometer + DS18B20 Temperature Sensor

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SMARTBEARING IoT HARDWARE RIG                      │
│                                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐  │
│  │  DC Motor    │────▶│  L298N      │────▶│  Arduino Uno R3         │  │
│  │  6-12V       │     │  Motor      │     │  (ATmega328P)           │  │
│  │  150 PWM     │     │  Driver     │     │  USB Serial 9600 baud   │  │
│  └─────────────┘     └─────────────┘     └───────────┬─────────────┘  │
│         │                     │                       │                │
│         │   ┌─────────────────┴───────────┐          │                │
│         │   │  12V DC Power Supply         │          │                │
│         │   │  (motor driver input)        │          │                │
│         │   └─────────────────────────────┘          │                │
│         │                                             │                │
│    ┌────▼────┐                                   ┌────▼────┐         │
│    │  LM393  │                                   │  USB    │         │
│    │  IR     │◀── shutter disc ──               │  Cable  │──▶💻    │
│    │  Tach   │     on motor shaft               │  (Host) │         │
│    └────┬────┘                                   └─────────┘         │
│         │                                                             │
│         │     ┌─────────────────┐                                    │
│         │     │  DS18B20        │                                    │
│         └────▶│  Temperature    │                                    │
│               │  Sensor         │                                    │
│               │  (OneWire)      │                                    │
│               └─────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────┘

Data Flow:
  Motor Shaft Rotation → IR Tach Pulses → Arduino (interrupt counting)
  Motor Heat → DS18B20 → Arduino (OneWire protocol)
  Arduino → JSON @ 9600 baud → Python ML Pipeline → SmartBearing Dashboard
```

---

## 2. Bill of Materials (BOM)

| # | Component | Part Number / Model | Qty | Electrical Specs | Physical Size | Notes |
|---|-----------|---------------------|-----|------------------|---------------|-------|
| 1 | **Arduino Uno R3** | A000066 (official) or CH340 clone | 1 | 5V logic, 14 digital I/O, 6 analog, 32KB flash | 68.6 × 53.3 mm | Microcontroller brain — USB programming |
| 2 | **L298N Motor Driver Module** | L298N Dual H-Bridge | 1 | Input 5–35V, Logic 5V, 2A per channel, PWM capable | 43 × 43 × 28 mm | Drives DC motor from Arduino PWM |
| 3 | **DC Motor** | 3V–12V DC hobby motor | 1 | 6–12V operating, 150mA–1A typical, PWM 150/255 | Ø20–25mm × 30–40mm | Must have shaft for tach disc + temp probe |
| 4 | **IR Optical Tachometer** | LM393 comparator module | 1 | 3.3–5V, <20mA, open-collector output | Ø20mm × 15mm | Infrared break-beam sensor |
| 5 | **Slotted Shutter Disc** | 1-slot optical disc | 1 | Laser-cut or 3D-printed plastic | Ø40–60mm | Mounted on motor shaft for RPM sensing |
| 6 | **DS18B20 Temperature Sensor** | Waterproof stainless probe | 1 | 3.0–5.5V, -55°C to +125°C, ±0.5°C accuracy | Probe Ø6mm × 30mm | OneWire protocol, needs 4.7kΩ pull-up |
| 7 | **4.7kΩ Resistor** | 1/4W carbon film | 1 | 4.7kΩ ±5% | Axial 6mm | Pull-up for DS18B20 DATA ↔ VCC |
| 8 | **12V DC Power Supply** | Wall adapter / battery pack | 1 | 12V, 2A minimum, 2.1mm barrel jack | — | Powers motor through L298N |
| 9 | **USB Type-B Cable** | Arduino USB cable | 1 | USB 2.0, data + power | ~1m | Programming + serial communication |
| 10 | **Breadboard** | Full-size solderless | 1 | 830 tie-points, split power rails | 165 × 55 mm | Sensor power distribution |
| 11 | **Jumper Wires (M-M)** | Dupont 20cm | 20 | — | 20cm length | Hookup wires |
| 12 | **Jumper Wires (M-F)** | Dupont 20cm | 10 | — | 20cm length | For module connections |

### Optional but Recommended

| # | Component | Purpose |
|---|-----------|---------|
| 13 | 1kΩ LED + 220Ω resistor | Visual power-on indicator |
| 14 | Capacitor 100μF / 25V | Motor noise suppression (across L298N motor terminals) |
| 15 | Zip ties / hot glue | Sensor mounting to motor housing |

---

## 3. Complete Electrical Specifications

### 3.1 Power Budget

| Rail | Source | Voltage | Current (max) | Powers |
|------|--------|---------|---------------|--------|
| **5V Logic** | Arduino USB or L298N regulator | 5.0V ±0.25V | 500mA total | Arduino MCU, LM393 tach, DS18B20, pull-up resistor |
| **12V Motor** | External power supply | 12V DC ±0.5V | 1A–2A | DC motor through L298N H-bridge |
| **Ground** | Common reference | 0V | — | ALL GNDs tied together |

> ⚠️ **Critical:** The 12V supply GND, L298N GND, and Arduino GND must all be connected to a common ground point. This is the #1 wiring mistake.

### 3.2 Arduino Pin Allocation

| Pin | Type | Direction | Connected To | Protocol/Notes |
|-----|------|-----------|-------------|----------------|
| **D2** | Digital | INPUT_PULLUP | LM393 OUT | Hardware interrupt INT0, FALLING edge |
| **D5** | Digital | INPUT | DS18B20 DATA | OneWire protocol, needs 4.7kΩ pull-up to 5V |
| **D9** | Digital (PWM) | OUTPUT | L298N ENA | PWM speed control, duty cycle 150/255 (58.8%) |
| **D10** | Digital | OUTPUT | L298N IN1 | Motor direction A (HIGH = forward) |
| **D11** | Digital | OUTPUT | L298N IN2 | Motor direction B (LOW for forward) |
| **5V** | Power | OUTPUT | LM393 VCC, breadboard red rail | Sensor power supply |
| **GND** | Power | OUTPUT | Common ground point | Shared reference |
| **USB** | Serial | Bidirectional | Host computer | 9600 baud, JSON telemetry stream |

### 3.3 L298N Motor Driver Pinout

```
         L298N MODULE (top view)
    ┌─────────────────────────────┐
    │  ┌───────────────────────┐  │
    │  │  HEATSINK (aluminum)  │  │
    │  └───────────────────────┘  │
    │                             │
    │  12V  GND  +5V  ENA  IN1  IN2  OUT1  OUT2 │
    │   ▲    ▲    ▲    ▲    ▲    ▲     ▲     ▲   │
    │   │    │    │    │    │    │     │     │   │
    │  12V  GND  5V   D9  D10  D11  Motor  Motor│
    │  Vcc  GND  Out  PWM  Dir  Dir  (+)   (-)  │
    └─────────────────────────────┘
```

| L298N Pin | Arduino Connection | Notes |
|-----------|-------------------|-------|
| **+12V** | 12V DC power supply (+) | Motor power input |
| **GND** | Common ground (12V−, Arduino GND, breadboard blue rail) | Must be shared |
| **+5V** | Arduino 5V (when 12V input present and 5V-jumper fitted) | Regulated 5V output — can power DS18B20 |
| **ENA** | Arduino D9 | PWM enable — controls motor speed |
| **IN1** | Arduino D10 | Direction control input 1 |
| **IN2** | Arduino D11 | Direction control input 2 |
| **OUT1** | DC motor terminal (+) | Motor power output |
| **OUT2** | DC motor terminal (−) | Motor power output |

> **ENA Jumper Note:** If the small jumper on ENA is fitted, the motor runs at full speed regardless of PWM. **Remove it** so D9 PWM controls the speed.

---

## 4. Complete Wiring Diagram

### 4.1 Schematic (ASCII)

```
                           COMMON GROUND POINT
                                  │
    ┌──────────────────────────────┼──────────────────────┐
    │                              │                      │
    │  ┌─────────────────────┐     │    ┌─────────────┐  │
    │  │   12V DC SUPPLY     │     │    │  ARDUINO    │  │
    │  │   ┌───┐  ┌───┐     │     │    │  UNO R3     │  │
    │  │   │+  │  │−  │     │     │    │             │  │
    │  │   └─┬─┘  └─┬─┘     │     │    │  D9  D10 D11│  │
    │  │     │      │        │     │    │  │   │   │  │  │
    │  │     │      │        │     │    │  │   │   │  │  │
    │  └─────┼──────┼────────┘     │    │  │   │   │  │  │
    │        │      │              │    │  │   │   │  │  │
    │        │      │         ┌────┴────┤  │   │   │  │  │
    │        │      │         │   5V    │  │   │   │  │  │
    │        │      │         │   GND   │  │   │   │  │  │
    │        │      │         │         │  │   │   │  │  │
    │        │      │         └────┬────┘  │   │   │  │  │
    │        │      │              │       │   │   │  │  │
    │        │      │         ┌────┴───────────┴───┴──┤  │
    │        │      │         │   L298N MOTOR DRIVER  │  │
    │        │      │         │                       │  │
    │        │      │         │ +12V  GND  ENA IN1 IN2│  │
    │        │      └────────▶│  ▲     ▲    ▲   ▲   ▲│  │
    │        └───────────────▶│  │     │    │   │   ││  │
    │                         │  │     │   D9  D10 D11│  │
    │                         │  │     │    │   │   ││  │
    │                         └──┼─────┼────┼───┼───┼┘  │
    │                            │     │    │   │   │    │
    │                         ┌──┘     │    │   │   │    │
    │                    12V  │   OUT1 │    │   │   │    │
    │                    SUPPLY│    │  │    │   │   │    │
    │                         │  ┌───▼──────┐ │   │    │
    │                         │  │ DC MOTOR │ │   │    │
    │                         │  │          │ │   │    │
    │                         │  └───┬──────┘ │   │    │
    │                         │      │ OUT2   │   │    │
    │                         └──────┘        │   │    │
    │                                        │   │    │
    │  ┌───────────────┐        ┌────────────┘   │    │
    │  │  LM393 IR TACH│        │  ┌──────────────┘   │
    │  │               │        │  │                  │
    │  │  VCC──5V ─────┤────────┼──┤                  │
    │  │  GND──GND ────┤────────┼──┼──────────────┐   │
    │  │  OUT──D2 ─────┤──▶ D2  │  │  ┌───────────┤   │
    │  └───────────────┘        │  │  │           │   │
    │        ▲                  │  │  │           │   │
    │   shutter disc            │  │  │           │   │
    │   (on motor shaft)        │  │  │           │   │
    │                           │  │  │           │   │
    │  ┌────────────────┐       │  │  │           │   │
    │  │  DS18B20 TEMP  │       │  │  │           │   │
    │  │                │       │  │  │           │   │
    │  │  VCC──5V ──────┤───────┼──┼──┼───────────┤   │
    │  │  GND──GND ─────┤───────┼──┼──┼───────────┘   │
    │  │  DATA──D5 ─────┤──▶ D5 │  │  │              │
    │  │        │       │       │  │  │              │
    │  │    4.7kΩ──5V   │       │  │  │              │
    │  └────────────────┘       │  │  │              │
    │                           │  │  │              │
    │  ┌─────────────────┐      │  │  │              │
    │  │  USB CABLE      │      │  │  │              │
    │  │  Arduino ←→ PC  │      │  │  │              │
    │  └─────────────────┘      │  │  │              │
    │                           │  │  │              │
    └───────────────────────────┼──┼──┼──────────────┘
                                │  │  │
                           GROUND│  │  GROUND
                                │  │  │
                          ALL GND TIED TOGETHER
```

### 4.2 Wire-by-Wire Connection Table

| Wire # | From | To | Color (suggested) | Type |
|--------|------|-----|-------------------|------|
| 1 | Arduino 5V | Breadboard red rail (+) | Red | M-M jumper |
| 2 | Arduino GND | Breadboard blue rail (−) | Black | M-M jumper |
| 3 | 12V Supply (+) | L298N "+12V" terminal | Red | Screw terminal / jumper |
| 4 | 12V Supply (−) | L298N "GND" terminal | Black | Screw terminal / jumper |
| 5 | L298N "GND" | Breadboard blue rail (−) | Black | M-M jumper |
| 6 | Arduino D9 | L298N "ENA" | Orange | M-M jumper |
| 7 | Arduino D10 | L298N "IN1" | Yellow | M-M jumper |
| 8 | Arduino D11 | L298N "IN2" | Green | M-M jumper |
| 9 | L298N "OUT1" | DC motor terminal (+) | Red | Motor wires |
| 10 | L298N "OUT2" | DC motor terminal (−) | Black | Motor wires |
| 11 | LM393 VCC | Breadboard red rail (+) | Red | M-M jumper |
| 12 | LM393 GND | Breadboard blue rail (−) | Black | M-M jumper |
| 13 | LM393 OUT | Arduino D2 | White | M-M jumper |
| 14 | DS18B20 VCC (+) | Breadboard red rail (+) | Red | M-M jumper |
| 15 | DS18B20 GND (−) | Breadboard blue rail (−) | Black | M-M jumper |
| 16 | DS18B20 DATA | Arduino D5 | Yellow | M-M jumper |
| 17 | DS18B20 DATA row | Breadboard red rail (+) | — | 4.7kΩ resistor |
| 18 | Arduino USB | Host computer USB port | — | USB Type-B cable |

---

## 5. Physical Layout & Mounting

### 5.1 Breadboard Layout (top view)

```
    BREADBOARD (830 tie-points)
    ┌─────────────────────────────────────────────────────────────┐
    │  RED (+) RAIL    ─────────────────────────────────────────  │
    │    │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │
    │  BLU (−) RAIL    ─────────────────────────────────────────  │
    │    │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │
    │  ┌──────────┐   ┌──────────┐   ┌──────────┐                │
    │  │  DS18B20 │   │  LM393   │   │ 4.7kΩ    │                │
    │  │  ┌─────┐ │   │  ┌─────┐ │   │  R───────┤────────────────┤
    │  │  │VCC  │ │   │  │VCC  │ │   │  │       │  (DATA to 5V) │
    │  │  │GND  │ │   │  │GND  │ │   │  └───────┘                │
    │  │  │DATA │ │   │  │OUT  │ │                                │
    │  │  └──┬──┘ │   │  └──┬──┘ │                                │
    │  └─────┼────┘   └─────┼────┘                                │
    │        │              │                                      │
    │    to D5 (jumpers)   to D2 (jumper)                         │
    │                                                               │
    │  POWER INPUTS:                                                │
    │  • Red rail ← Arduino 5V (jumper wire)                       │
    │  • Blue rail ← Arduino GND (jumper wire)                     │
    │  • Blue rail ← L298N GND (jumper wire — shared ground!)      │
    └─────────────────────────────────────────────────────────────┘
```

### 5.2 Physical Component Placement

```
    TOP VIEW — MECHANICAL LAYOUT
    ┌─────────────────────────────────────────────────────────────┐
    │                                                             │
    │    ┌─────────────┐      ┌───────────────────────┐         │
    │    │             │      │                       │         │
    │    │   ARDUINO   │      │    L298N MODULE       │         │
    │    │   UNO R3    │──────│    + HEATSINK         │         │
    │    │             │ wire │                       │         │
    │    └──────┬──────┘      └───────────┬───────────┘         │
    │           │ USB                     │ 12V IN               │
    │           │                         │                      │
    │    ┌──────▼──────┐           ┌──────▼──────┐              │
    │    │  USB CABLE  │           │  12V DC     │              │
    │    │  to Host PC │           │  POWER      │              │
    │    └─────────────┘           │  SUPPLY     │              │
    │                              └─────────────┘              │
    │                                                             │
    │    ┌─────────────────────────────────────────────────┐     │
    │    │               DC MOTOR ASSEMBLY                 │     │
    │    │                                                 │     │
    │    │    ┌───────────┐    ┌───────────┐              │     │
    │    │    │  DC MOTOR │    │ SHUTTER   │              │     │
    │    │    │  ┌─────┐  │────│ DISC      │              │     │
    │    │    │  │SHAFT│  │    │ (slotted) │              │     │
    │    │    │  └──┬──┘  │    └─────┬─────┘              │     │
    │    │    └─────┼─────┘          │                     │     │
    │    │          │           ┌────▼────┐                │     │
    │    │          │           │  LM393  │                │     │
    │    │          │           │  IR TACH│                │     │
    │    │          │           └─────────┘                │     │
    │    │    ┌─────┴─────┐                                │     │
    │    │    │  DS18B20  │                                │     │
    │    │    │  PROBE    │                                │     │
    │    │    │  (zip-tied│                                │     │
    │    │    │  to motor │                                │     │
    │    │    │  housing) │                                │     │
    │    │    └───────────┘                                │     │
    │    └─────────────────────────────────────────────────┘     │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
```

### 5.3 Mechanical Mounting Notes

| Component | Mounting Method | Notes |
|-----------|----------------|-------|
| Arduino Uno | Flat on workbench / adhesive standoffs | USB port accessible for programming |
| L298N Module | Flat, heatsink facing up | Away from motor vibration |
| DC Motor | Clamped / hot-glued to rigid base | Shaft must be free to rotate |
| Shutter Disc | Press-fit / glue to motor shaft | Centered for balance |
| LM393 Tachometer | Hot-glued adjacent to disc edge | IR beam must pass through slot |
| DS18B20 Probe | Zip-tied / thermal-pasted to motor housing | Good thermal contact |
| Breadboard | Flat on workbench | Near Arduino for short jumper runs |
| 12V Power Supply | Separate from sensor area | Reduces electrical noise |

---

## 6. Firmware Specifications

### 6.1 Motor Monitor Sketch (`motor_monitor.ino`)

**Target Board:** Arduino Uno R3 (ATmega328P, 16 MHz)  
**Required Libraries:**
- `OneWire` v2.3+ (OneWire bus protocol)
- `DallasTemperature` v3.9+ (DS18B20 driver)

**Operating Parameters:**

| Parameter | Value | Notes |
|-----------|-------|-------|
| Serial baud rate | 9600 | Fixed — Python pipeline expects this |
| Output format | JSON, one line per second | `{"rpm":1440.0,"temperature":28.5,"motorSpeed":150}` |
| PWM duty cycle | 150/255 (58.8%) | Constant — not dynamic |
| Tach interrupt | D2/INT0, FALLING edge | Hardware interrupt, no polling |
| Temp read interval | 1 second | Non-blocking, millis()-based |
| Temp fail-safe | Returns `null` on error | Never emits -127 or -999 |
| RPM calculation | `pulses × 60.0 / seconds` | Assumes 1 pulse per revolution |
| Flash usage | ~28% | 8,606 / 32,256 bytes |
| RAM usage | ~42% | 2,138 / 2,048 bytes |

**Serial Output Format (every 1 second):**
```json
{
  "rpm": 1440.0,
  "temperature": 28.5,
  "motorSpeed": 150
}
```

**Error Handling:**
- Corrupt/empty serial lines → skipped (never fatal)
- DS18B20 missing → `"temperature": null`
- DS18B20 error → `"temperature": null`
- Physical range check: RPM 0–100,000, temp -55°C to +125°C

### 6.2 Wiring Test Sketch (`wiring_test.ino`)

**Purpose:** Diagnostic self-test in ~10 seconds  
**Output:** PASS/FAIL verdict per subsystem on Serial Monitor

**Test Sequence:**
1. **Motor Driver Test** — drives ENA/IN1/IN2, asks user to verify shaft rotation
2. **Tachometer Test** — counts FALLING-edge interrupts for 5 seconds
3. **DS18B20 Test** — scans OneWire bus, reports device count + ROM address + live temp

**Interactive Commands:**
- `r` + Enter → re-run self-test
- `0` → park (idle)

---

## 7. Sensor Specifications

### 7.1 LM393 IR Optical Tachometer

| Specification | Value |
|---------------|-------|
| Operating voltage | 3.3V–5V DC |
| Operating current | <20mA |
| Output type | Open-collector (needs INPUT_PULLUP on Arduino) |
| Detection method | Infrared break-beam (reflective also works) |
| Response time | <1ms |
| Output signal | Digital HIGH/LOW (beam broken = LOW, FALLING edge) |
| Detection distance | 2–30mm (optimal 10–15mm) |
| Slot width | Must match shutter disc slit width (~2–5mm) |

**RPM Calculation:**
```
RPM = (pulse_count × 60) / time_window_seconds
     = pulses × 60    (for 1-second window)
```
- 1 pulse per revolution (single-slot disc)
- 2 pulses per revolution → divide by 2
- 4 pulses per revolution → divide by 4

### 7.2 DS18B20 Digital Temperature Sensor

| Specification | Value |
|---------------|-------|
| Operating voltage | 3.0V–5.5V DC |
| Resolution | 9–12 bits (configurable) |
| Temperature range | -55°C to +125°C |
| Accuracy | ±0.5°C (-10°C to +85°C) |
| Conversion time | 750ms (12-bit) |
| Protocol | OneWire (1 data wire + VCC + GND) |
| Pull-up resistor | 4.7kΩ (DATA to VCC) — **required** |
| Max devices on bus | Practically unlimited (each has unique ROM) |

**Fail-Safe Handling:**
- `-127.00°C` → bus short or missing pull-up → emits `"temperature": null`
- `NaN / Inf` → electrical noise → emits `"temperature": null`
- `>124.9°C` or `<-126.9°C` → out of physical range → emits `"temperature": null`

---

## 8. Python Pipeline Specifications

### 8.1 Software Requirements

**File:** `hardware/main.py`  
**Dependencies** (`requirements.txt`):
```
pyserial>=3.5
numpy>=1.24
scikit-learn>=1.3
joblib>=1.3
rich>=13.0
```

**Virtual Environment:**
```bash
cd hardware
python3 -m venv .venv
source .venv/bin/activate    # Linux/Mac
# .venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

### 8.2 Pipeline Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Rolling window | 30 seconds | Feature computation window |
| Calibration period | 30 seconds | Initial baseline recording |
| Anomaly thresholds | Temp > 60°C OR RPM drop > 30% | Hard safety trip |
| Health index range | 0.0–1.0 | 1.0 = perfectly healthy |
| Health thresholds | ≥0.70 HEALTHY, 0.35–0.70 WARNING, <0.35 FAULT | Color-coded |
| Model file | `hardware/model.pkl` | Auto-created on first calibration |
| CSV log | `hardware/predictive_maintenance_log.csv` | One row per second |
| Serial reconnect | 3-second retry loop | Survives USB disconnects |

### 8.3 Feature Vector (5 dimensions)

| Feature | Description | Unit |
|---------|-------------|------|
| `rpm_mean` | Mean RPM over 30s window | rev/min |
| `rpm_std` | Standard deviation of RPM | rev/min |
| `temp_mean` | Mean temperature over 30s window | °C |
| `temp_rate_of_change` | Temperature slope (°C/s) | °C/s |
| `rpm_temp_ratio` | RPM ÷ temperature | rev/min/°C |

### 8.4 Anomaly Detection Engine

**Algorithm:** IsolationForest (scikit-learn)
- `n_estimators=100`
- `contamination=0.05`
- `random_state=42`

**Scoring:**
```
health_index = sigmoid(3.0 × decision_function(x))
```
Where `sigmoid(z) = 1 / (1 + e^(-z))` — maps anomaly score to 0–1 health.

---

## 9. Dashboard Integration

### 9.1 API Endpoint

**URL:** `POST http://localhost:5001/api/hardware/ingest`  
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "timestamp_utc": "2026-08-19T12:00:00Z",
  "rpm": 1440.0,
  "temperature": 28.5,
  "motor_speed": 150,
  "rpm_mean": 1438.5,
  "rpm_std": 2.34,
  "temp_mean": 28.21,
  "temp_rate_of_change": 0.015,
  "rpm_temp_ratio": 51.0,
  "health_index": 0.892,
  "verdict": "HEALTHY"
}
```

### 9.2 Dashboard Page — Hardware Lab

**URL:** `http://localhost:5173/hardware`

**Display Elements:**
1. **Live PWM Card** — shows 150/255 when streaming, LIVE chip, connection heartbeat
2. **Dataset Analytics** — RPM (~1440), Temperature (~28°C), Health Index (0.892)
3. **Live PWM Chart** — real-time line chart, 1 Hz updates
4. **Dataset Analytics Chart** — RPM + Temperature dual-axis
5. **Connection Status** — LIVE (green) / STOPPED (red) with 3.5s watchdog
6. **ML Verdict** — HEALTHY / WARNING / FAULT with confidence

### 9.3 Data Sources

| Display | Source | Update Rate |
|---------|--------|-------------|
| Live PWM | Arduino frames only | 1 Hz |
| RPM | Dataset simulator (reference) | 1 Hz |
| Temperature | Dataset simulator (reference) | 1 Hz |
| Health Index | IsolationForest computation | 1 Hz |
| Verdict | Dual anomaly engine | 1 Hz |

---

## 10. Testing Procedure

### 10.1 Wiring Self-Test (10 seconds)

1. Flash `wiring_test.ino` via Arduino IDE
2. Open Serial Monitor at 9600 baud
3. Observe:
   - `[1] MOTOR DRIVER` → verify shaft turns
   - `[2] TACHOMETER` → ≥2 pulses in 5s = PASS
   - `[3] DS18B20` → "Devices found: 1" + valid temperature = PASS
4. Type `r` to re-run, `0` to park

### 10.2 Live Operation Test

1. Flash `motor_monitor.ino`
2. Run `python main.py --port /dev/cu.usbmodem101`
3. Verify Serial Monitor shows JSON lines at 1 Hz
4. Run motor → RPM values > 0
5. Verify CSV log appending
6. Verify dashboard Hardware Lab page showing live data

### 10.3 Expected Values (Healthy Motor)

| Measurement | Expected Range | Notes |
|-------------|---------------|-------|
| RPM | 1400–1480 | ±50 rev/min around 1440 nominal |
| Temperature | 25–35°C | Ambient + motor heat |
| Motor Speed | 150 | Constant PWM command |
| Health Index | 0.70–1.00 | HEALTHY verdict |
| Pulse Rate | 24 per second | At 1440 RPM with 1 pulse/rev |

---

## 11. 3D Simulation Requirements (for Tinkercad/Tinkered.ai)

### 11.1 Components to Model

| Component | Shape | Key Dimensions | Material/Color |
|-----------|-------|----------------|----------------|
| Arduino Uno | Rectangular PCB | 68.6 × 53.3 × 8mm | Blue PCB, silver headers |
| L298N Module | Rectangular block | 43 × 43 × 28mm | Red PCB, black heatsink |
| DC Motor | Cylindrical | Ø22mm × 32mm | Silver metallic, shaft Ø2mm |
| LM393 Sensor | Small PCB + IR pair | Ø18mm × 10mm | Black PCB |
| DS18B20 Probe | Cylindrical probe | Ø6mm × 30mm | Stainless steel |
| Shutter Disc | Flat circle with slot | Ø50mm × 2mm | Black plastic |
| Breadboard | Rectangular block | 165 × 55 × 10mm | White with power rails |
| 12V Power Supply | Rectangular brick | 50 × 30 × 25mm | Black |
| USB Cable | Flexible cylinder | ~30cm × 3mm | Black |
| Jumper Wires | Thin cylinders | ~15cm × 1mm | Various colors |

### 11.2 Animation Requirements

| Animation | Trigger | Effect |
|-----------|---------|--------|
| Motor shaft rotation | Motor ON | Continuous rotation around shaft axis |
| Shutter disc rotation | Motor ON | Disc rotates with shaft |
| IR tach LED blink | Shutter slot passes | LED blinks at RPM frequency |
| Temperature probe glow | Heat detection | Color gradient blue→red |
| PWM signal visualization | Motor ON | Oscilloscope-style wave on D9 |
| Serial data flow | Arduino active | JSON packets flowing USB→host |

### 11.3 Interactive Elements

| Element | Action | Result |
|---------|--------|--------|
| 12V power switch | Toggle ON/OFF | Motor starts/stops, RPM changes |
| PWM slider (D9) | Drag 0–255 | Motor speed changes, RPM adjusts |
| Temperature display | Auto-update | Shows °C from DS18B20 |
| RPM counter | Auto-update | Shows rev/min from tach |
| Serial monitor | Button click | Shows live JSON output |

---

## 12. Troubleshooting Guide

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No motor rotation | 12V not connected to L298N | Connect 12V supply to L298N "+12V" |
| Motor runs at full speed | ENA jumper fitted on L298N | Remove ENA jumper, use D9 PWM |
| 0 RPM reading | Tach disc not aligned in IR slot | Align disc so IR beam passes through slot |
| Temperature = null | Missing 4.7kΩ pull-up | Add resistor between DS18B20 DATA and 5V |
| Temperature = -127°C | DS18B20 bus shorted | Check wiring, verify pull-up present |
| Serial garbled | Wrong baud rate | Set Serial Monitor to 9600 baud |
| Pipeline crashes on USB disconnect | No reconnect logic | Use latest `main.py` with reconnect loop |
| Dashboard shows "OFFLINE" | Arduino not streaming | Check USB cable, verify `motor_monitor.ino` is running |

---

## 13. Compliance with Problem Statement

| Requirement | Hardware Implementation |
|-------------|------------------------|
| Real-time data collection | Arduino streams at 1 Hz via USB serial |
| Vibration monitoring | IR tachometer counts shaft rotation (proxy for vibration) |
| Temperature monitoring | DS18B20 digital probe (±0.5°C accuracy) |
| Motor control | L298N H-bridge with PWM speed control |
| Anomaly detection | IsolationForest on 5-feature vector (30s window) |
| Dashboard integration | Python pipeline → API → WebSocket → React dashboard |
| Edge device capability | Arduino Uno (low-cost, portable, USB-powered) |
| Fault classification | Dual engine: hard thresholds + ML health index |

---

*This document provides everything needed for a 3D simulation of the SmartBearing IoT hardware rig. All electrical specifications, pin assignments, physical dimensions, and operational parameters are documented for Tinkercad/Tinkered.ai implementation.*

**Generated for:** SmartBearing IoT Predictive Maintenance System  
**Hardware Version:** 1.0  
**Documentation Version:** 1.0
