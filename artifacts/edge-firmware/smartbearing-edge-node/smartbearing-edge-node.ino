/*
 * SmartBearing Edge Node — ESP32 + ADXL345 / MPU6050
 * ===================================================
 * Samples 2048 raw vibration points from a MEMS accelerometer, AC-couples
 * them (removes the DC/gravity offset), and POSTs them to the SmartBearing
 * ingestion endpoint:
 *
 *     POST {server}/api/sensors/reading
 *
 * The server runs the ML fault model, computes the real FFT, saves the
 * reading, raises alerts, and pushes it live to the dashboard over Socket.io
 * — exactly as if it came from the built-in simulator.
 *
 * Wiring
 * ------
 *   ADXL345 (SPI — up to 3200 Hz, recommended):
 *     VCC -> 3V3, GND -> GND, CS -> GPIO5, MOSI(SDA) -> GPIO23,
 *     MISO(SDO) -> GPIO19, SCK -> GPIO18
 *   ADXL345 (I2C — up to ~800 Hz):
 *     VCC -> 3V3, GND -> GND, SDA -> GPIO21, SCL -> GPIO22
 *   MPU6050 (I2C — up to 1000 Hz):
 *     VCC -> 3V3, GND -> GND, SDA -> GPIO21, SCL -> GPIO22, AD0 -> GND
 *
 * Flashing: Arduino IDE -> Board "ESP32 Dev Module" -> Upload. Requires the
 * ESP32 Arduino core (no extra libraries — register-level access used).
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <SPI.h>

/* ============================ CONFIG ============================ */

// WiFi
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";

// Server. For the Cloudflare tunnel the host is the *.trycloudflare.com URL
// and the port is 443 (HTTPS). For a LAN/plain-HTTP server use port 80 and
// set USE_HTTPS to false.
const char *SERVER_HOST = "parallel-avon-solved-pen.trycloudflare.com";
const uint16_t SERVER_PORT = 443;
const bool USE_HTTPS = true;
const char *API_PATH = "/api/sensors/reading";

// Device key — must match EDGE_DEVICE_KEY on the server. Leave empty if the
// server runs with EDGE_DEVICE_KEY unset (dev mode, open endpoint).
const char *DEVICE_KEY = "";

// Identity — use a seeded machine id (M001..M006) so the reading lands on an
// existing machine on the dashboard.
const char *MACHINE_ID = "M001";
const char *SPINDLE_ID = "SN001";

// Sampling — keep BUFFER_SIZE at 2048 (the ML model expects exactly 2048).
const uint16_t BUFFER_SIZE = 2048;
const uint32_t SAMPLE_RATE_HZ = 3200; // ADXL345 SPI max; use 800 (I2C) / 1000 (MPU6050)
const uint32_t BATCH_INTERVAL_MS = 3000; // gap between two uploads

// Optional metadata the node can report (tune per installation)
const float NOMINAL_RPM = 12000.0;
const float TEMP_C_FALLBACK = 40.0; // used for ADXL345 (no onboard temp sensor)

// Sensor selection — uncomment exactly ONE
#define SENSOR_ADXL345_SPI
// #define SENSOR_ADXL345_I2C
// #define SENSOR_MPU6050_I2C

// Status LED (built-in on most ESP32 dev boards)
#define STATUS_LED 2

/* ================================================================ */

// ADXL345 I2C address (SDO low). SPI uses CS pin below.
#define ADXL345_I2C_ADDR 0x53
#define ADXL345_CS_PIN 5

// MPU6050 I2C address (AD0 low)
#define MPU6050_I2C_ADDR 0x68

#ifdef SENSOR_ADXL345_SPI
SPIClass *vspi = nullptr;
#endif

void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED, OUTPUT);

  Serial.println("\n[SmartBearing Edge Node] booting...");
  initSensor();
  connectWiFi();
  blinkLed(2, 300);
  Serial.printf("[cfg] machine=%s spindle=%s rate=%uHz buffer=%u\n",
                MACHINE_ID, SPINDLE_ID, (unsigned)SAMPLE_RATE_HZ, BUFFER_SIZE);
}

void loop() {
  static float buffer[BUFFER_SIZE];
  static float acBuffer[BUFFER_SIZE];

  // 1. Capture a full window of raw samples
  uint32_t t0 = micros();
  captureWindow(buffer);
  uint32_t captureUs = micros() - t0;

  // 2. AC-couple (remove DC/gravity offset) — matches server-side processing
  float mean = 0;
  for (uint16_t i = 0; i < BUFFER_SIZE; i++) mean += buffer[i];
  mean /= BUFFER_SIZE;
  for (uint16_t i = 0; i < BUFFER_SIZE; i++) acBuffer[i] = buffer[i] - mean;

  // 3. Local RMS for serial diagnostics
  float sumSq = 0;
  for (uint16_t i = 0; i < BUFFER_SIZE; i++) sumSq += acBuffer[i] * acBuffer[i];
  float rms = sqrt(sumSq / BUFFER_SIZE);

  Serial.printf("[sample] %u pts in %.0f us (%.0f Hz) | AC RMS %.3f g\n",
                BUFFER_SIZE, (float)captureUs, 1e6f / captureUs, rms);

  // 4. Upload
  bool ok = uploadReading(acBuffer, rms);
  blinkLed(ok ? 2 : 6, ok ? 150 : 90);
  if (!ok) {
    // Backoff on failure; reconnect WiFi if we lost it
    Serial.println("[warn] upload failed — retrying in 10s");
    delay(10000);
    if (WiFi.status() != WL_CONNECTED) connectWiFi();
  } else {
    delay(BATCH_INTERVAL_MS);
  }
}

/* ---------------- Sensor init / read ---------------- */

void initSensor() {
#ifdef SENSOR_ADXL345_SPI
  vspi = new SPIClass(VSPI);
  vspi->begin();
  pinMode(ADXL345_CS_PIN, OUTPUT);
  digitalWrite(ADXL345_CS_PIN, HIGH);
  delay(10);

  // DATA_FORMAT: full-res, +/-16g -> 0x0B
  adxlWriteReg(0x31, 0x0B);
  // BW_RATE: 3200 Hz -> 0x0F
  uint8_t bw = (SAMPLE_RATE_HZ >= 1600) ? 0x0F : 0x0D;
  adxlWriteReg(0x2C, bw);
  // POWER_CTL: measurement mode
  adxlWriteReg(0x2D, 0x08);
  Serial.println("[sensor] ADXL345 via SPI (+/-16g, full-res)");
#elif defined(SENSOR_ADXL345_I2C)
  Wire.begin();
  Wire.beginTransmission(ADXL345_I2C_ADDR);
  if (Wire.endTransmission() != 0) {
    Serial.println("[fatal] ADXL345 not found on I2C");
  }
  Wire.beginTransmission(ADXL345_I2C_ADDR);
  Wire.write(0x31);
  Wire.write(0x0B); // full-res +/-16g
  Wire.endTransmission();
  Wire.beginTransmission(ADXL345_I2C_ADDR);
  Wire.write(0x2C);
  Wire.write(0x0D); // 800 Hz (I2C-safe)
  Wire.endTransmission();
  // I2C is capped at 800 Hz regardless of SAMPLE_RATE_HZ — keep the two in sync
  // so captureWindow doesn't oversample and produce duplicated samples.
  if (SAMPLE_RATE_HZ > 800) {
    Serial.println("[warn] I2C caps at 800 Hz — override SAMPLE_RATE_HZ to 800");
  }
  Wire.beginTransmission(ADXL345_I2C_ADDR);
  Wire.write(0x2D);
  Wire.write(0x08); // measure
  Wire.endTransmission();
  Serial.println("[sensor] ADXL345 via I2C (+/-16g, 800 Hz)");
#elif defined(SENSOR_MPU6050_I2C)
  Wire.begin();
  Wire.beginTransmission(MPU6050_I2C_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1
  Wire.write(0x00); // wake
  Wire.endTransmission();
  Wire.beginTransmission(MPU6050_I2C_ADDR);
  Wire.write(0x1C); // ACCEL_CONFIG
  Wire.write(0x18); // +/-16g
  Wire.endTransmission();
  Serial.println("[sensor] MPU6050 via I2C (+/-16g)");
#endif
}

#ifdef SENSOR_ADXL345_SPI
void adxlWriteReg(uint8_t reg, uint8_t val) {
  digitalWrite(ADXL345_CS_PIN, LOW);
  vspi->transfer(reg);
  vspi->transfer(val);
  digitalWrite(ADXL345_CS_PIN, HIGH);
}

void adxlReadXYZ(int16_t *x, int16_t *y, int16_t *z) {
  digitalWrite(ADXL345_CS_PIN, LOW);
  vspi->transfer(0x32 | 0x80);
  uint8_t xl = vspi->transfer(0x00), xh = vspi->transfer(0x00);
  uint8_t yl = vspi->transfer(0x00), yh = vspi->transfer(0x00);
  uint8_t zl = vspi->transfer(0x00), zh = vspi->transfer(0x00);
  digitalWrite(ADXL345_CS_PIN, HIGH);
  *x = (int16_t)((xh << 8) | xl);
  *y = (int16_t)((yh << 8) | yl);
  *z = (int16_t)((zh << 8) | zl);
}
#endif

// Returns Z-axis acceleration in g
float readAccelG() {
#ifdef SENSOR_ADXL345_SPI
  int16_t x, y, z;
  adxlReadXYZ(&x, &y, &z);
  return z * 0.0039f; // full-res +/-16g -> 3.9 mg/LSB
#elif defined(SENSOR_ADXL345_I2C)
  Wire.beginTransmission(ADXL345_I2C_ADDR);
  Wire.write(0x32);
  Wire.endTransmission(false);
  Wire.requestFrom(ADXL345_I2C_ADDR, (uint8_t)6);
  // Register pointer auto-increments: X_L, X_H, Y_L, Y_H, Z_L, Z_H
  int16_t xl = Wire.read(), xh = Wire.read();
  int16_t yl = Wire.read(), yh = Wire.read();
  int16_t zl = Wire.read(), zh = Wire.read();
  (void)xl; (void)xh; (void)yl; (void)yh;
  return (int16_t)((zh << 8) | zl) * 0.0039f;
#elif defined(SENSOR_MPU6050_I2C)
  Wire.beginTransmission(MPU6050_I2C_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_I2C_ADDR, (uint8_t)6);
  Wire.read(); Wire.read(); // x unused
  Wire.read(); Wire.read(); // y unused
  int16_t z = (int16_t)((Wire.read() << 8) | Wire.read());
  return z / 2048.0f; // +/-16g -> 2048 LSB/g
#endif
}

float readTempC() {
#ifdef SENSOR_MPU6050_I2C
  Wire.beginTransmission(MPU6050_I2C_ADDR);
  Wire.write(0x41);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_I2C_ADDR, (uint8_t)2);
  int16_t raw = (int16_t)((Wire.read() << 8) | Wire.read());
  return raw / 340.0f + 36.53f;
#else
  return TEMP_C_FALLBACK;
#endif
}

// Sample BUFFER_SIZE points at ~SAMPLE_RATE_HZ
void captureWindow(float *out) {
  uint32_t periodUs = 1000000UL / SAMPLE_RATE_HZ;
  for (uint16_t i = 0; i < BUFFER_SIZE; i++) {
    uint32_t next = micros() + periodUs;
    out[i] = readAccelG();
    while ((int32_t)(micros() - next) < 0) { yield(); }
  }
}

/* ---------------- WiFi ---------------- */

void connectWiFi() {
  Serial.printf("[wifi] connecting to %s...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint8_t tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries++ < 40) {
    delay(500);
    blinkLed(1, 100);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] connected — IP %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[wifi] FAILED to connect");
  }
}

/* ---------------- Upload ---------------- */

bool uploadReading(float *acSignal, float rms) {
  if (WiFi.status() != WL_CONNECTED) return false;

  // Build JSON body manually (2048 floats ~ 15 KB — fine on ESP32)
  String body = String("{\"machineId\":\"") + MACHINE_ID +
                "\",\"spindleId\":\"" + SPINDLE_ID +
                "\",\"sampleRateHz\":" + String(SAMPLE_RATE_HZ) +
                ",\"rpm\":" + String(NOMINAL_RPM, 0) +
                ",\"temperature\":" + String(readTempC(), 1) +
                ",\"signal\":[";
  char num[16];
  for (uint16_t i = 0; i < BUFFER_SIZE; i++) {
    dtostrf(acSignal[i], 1, 4, num);
    body += num;
    if (i < BUFFER_SIZE - 1) body += ",";
  }
  body += "]}";

  bool ok = false;
  if (USE_HTTPS) {
    WiFiClientSecure client;
    client.setInsecure(); // demo tunnel — pin the CA cert for production
    ok = httpPost(client, body);
  } else {
    WiFiClient client;
    ok = httpPost(client, body);
  }
  return ok;
}

template <typename T>
bool httpPost(T &client, const String &body) {
  if (!client.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.println("[http] connect failed");
    return false;
  }

  client.print(String("POST ") + API_PATH + " HTTP/1.1\r\n");
  client.print(String("Host: ") + SERVER_HOST + "\r\n");
  client.print("Content-Type: application/json\r\n");
  client.print(String("Content-Length: ") + body.length() + "\r\n");
  if (strlen(DEVICE_KEY) > 0) {
    client.print(String("x-device-key: ") + DEVICE_KEY + "\r\n");
  }
  client.print("Connection: close\r\n\r\n");
  client.print(body);

  // Read status line
  String statusLine = client.readStringUntil('\n');
  Serial.printf("[http] %s", statusLine.c_str());
  bool ok = statusLine.indexOf(" 200 ") > 0 || statusLine.indexOf(" 201 ") > 0;
  // Drain the rest
  while (client.available()) client.read();
  client.stop();
  return ok;
}

/* ---------------- LED helper ---------------- */

void blinkLed(uint8_t times, uint16_t ms) {
  for (uint8_t i = 0; i < times; i++) {
    digitalWrite(STATUS_LED, HIGH);
    delay(ms);
    digitalWrite(STATUS_LED, LOW);
    delay(ms);
  }
}
