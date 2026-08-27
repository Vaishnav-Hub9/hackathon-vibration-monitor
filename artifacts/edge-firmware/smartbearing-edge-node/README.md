# SmartBearing Edge Node (ESP32)

Plug real hardware into the SmartBearing platform. This firmware turns an
**ESP32 + ADXL345** (or **MPU6050**) into a vibration edge node that streams
raw 2048-point samples to the ingestion endpoint:

```
POST {server}/api/sensors/reading
```

The server then runs the **real ML fault model** on the samples, computes the
**real FFT** for the dashboard spectrum, saves the reading to MongoDB, raises
WhatsApp-style alerts when health drops, and pushes it **live over Socket.io**
— the exact same pipeline the built-in simulator uses. Plug in a sensor and it
drives the dashboard like a simulated node, but with real data.

---

## 1. The endpoint (already live on your backend)

```
POST /api/sensors/reading
Content-Type: application/json
x-device-key: <optional — only if the server sets EDGE_DEVICE_KEY>

{
  "machineId": "M001",          // required — must exist (seeded: M001..M006)
  "spindleId": "SN001",         // optional, defaults to SN001
  "signal": [ 2048 floats ],    // required — raw vibration samples in g
  "sampleRateHz": 3200,         // optional, default 1000 — drives the FFT axis
  "rpm": 12000,                 // optional
  "temperature": 41.5,          // optional
  "voltageNormalized": 220.0    // optional
}
```

**Response** (200):

```json
{
  "success": true,
  "data": {
    "readingId": "...",
    "machineId": "M001",
    "spindleId": "SN001",
    "timestamp": "...",
    "healthScore": 97,
    "label": "Healthy",
    "confidence": 0.99,
    "anomalyFlag": false,
    "bpfoScore": 0.158,
    "temperature": 41.5,
    "rpm": 12000
  }
}
```

Validation: `signal` must be exactly 2048 finite numbers, `machineId` must
exist (404 otherwise), numeric fields must be numbers.

**Device security:** set `EDGE_DEVICE_KEY=<secret>` in the server environment
and the endpoint will reject any node that doesn't send that secret in the
`x-device-key` header. Without it, the endpoint is open (dev/demo mode).

**Quick test without hardware** (from any machine):

```bash
curl -X POST http://localhost:5000/api/sensors/reading \
  -H "Content-Type: application/json" \
  -d '{"machineId":"M001","spindleId":"SN-HW1","sampleRateHz":1000,"signal":'$(python3 -c "
import json,math
print(json.dumps([0.3*math.sin(2*math.pi*157*i/1000) for i in range(2048)]))")'}'
```

---

## 2. Firmware quick start

1. Open `smartbearing-edge-node.ino` in the **Arduino IDE** (or PlatformIO).
2. Install the **ESP32 board package** (Board Manager → search "esp32" →
   "esp32 by Espressif"). No other libraries required — register-level I2C/SPI.
3. Edit the **CONFIG** block at the top:
   - `WIFI_SSID` / `WIFI_PASS`
   - `SERVER_HOST` → your public URL (e.g. `parallel-avon-solved-pen.trycloudflare.com`)
   - `SERVER_PORT` → `443` for the HTTPS tunnel (`USE_HTTPS = true`)
   - `MACHINE_ID` → an existing machine id (`M001`..`M006`)
   - `SPINDLE_ID` → a label for this node (e.g. `SN001`)
   - `SAMPLE_RATE_HZ` → `3200` (ADXL345 SPI), `800` (ADXL345 I2C), `1000` (MPU6050)
   - `DEVICE_KEY` → set it if you enabled `EDGE_DEVICE_KEY` on the server
4. Uncomment **exactly one** sensor define:
   ```cpp
   #define SENSOR_ADXL345_SPI   // recommended: 3200 Hz
   // #define SENSOR_ADXL345_I2C
   // #define SENSOR_MPU6050_I2C
   ```
5. Board: **ESP32 Dev Module** → Upload. Watch the Serial Monitor at 115200.

### Wiring

| ADXL345 (SPI, recommended) | ESP32 |
|---|---|
| VCC | 3V3 |
| GND | GND |
| CS | GPIO5 |
| SDA (MOSI) | GPIO23 |
| SDO (MISO) | GPIO19 |
| SCL (SCK) | GPIO18 |

| ADXL345 (I2C) / MPU6050 (I2C) | ESP32 |
|---|---|
| VCC | 3V3 |
| GND | GND |
| SDA | GPIO21 |
| SCL | GPIO22 |
| AD0 (MPU6050) | GND (addr 0x68) |

> Mount the sensor rigidly to the bearing housing. **Avoid pointing the Z axis
> perfectly vertical** — the firmware AC-couples the signal (removes the +1 g
> gravity offset) before upload, and the server AC-couples again, so a resting
> sensor reads ~0 g regardless. For best signal, mount so the monitored axis is
> perpendicular to gravity (e.g. Z horizontal, measuring radial vibration).

---

## 3. Behavior

- **Loop:** sample 2048 points → AC-couple → local RMS print → POST → blink.
- **Status LED:** 2 quick blinks = uploaded OK; 6 blinks = failed (retries in
  10 s and reconnects WiFi if needed).
- **Serial output** shows sample rate achieved, AC RMS in g, and the HTTP
  status line (`HTTP/1.1 200` = success).

---

## 4. Production hardening

- **HTTPS certificate:** `client.setInsecure()` is used for the Cloudflare
  demo tunnel. For production, pin the CA certificate of your domain instead.
- **Auth:** enable `EDGE_DEVICE_KEY` on the server and set `DEVICE_KEY` in the
  firmware.
- **Rate:** at 3200 Hz, one window is ~640 ms plus network time. With a 3 s
  batch interval that's one upload every ~3.6 s — comfortable for WiFi.

---

## 5. Files

| File | Purpose |
|---|---|
| `smartbearing-edge-node.ino` | ESP32 firmware (ADXL345 SPI/I2C, MPU6050 I2C) |
| `artifacts/api-server/src/routes/sensors.ts` | `POST /api/sensors/reading` endpoint |
| `artifacts/api-server/src/simulator/ingest.ts` | shared edge-reading pipeline (ML → save → alerts → socket) |
| `artifacts/api-server/src/lib/fft.ts` | real radix-2 FFT → 128-bin dashboard spectrum |
