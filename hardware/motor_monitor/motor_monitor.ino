/*
 * motor_monitor.ino — SmartBearing Hardware Lab firmware
 * ─────────────────────────────────────────────────────────
 * Target  : Arduino Uno R3
 * Rig     : DC motor (L298N driver) + IR tachometer (LM393) + DS18B20 temp
 *
 * Wiring (see hardware/README.md for the full pin map):
 *   L298N  ENA -> D9   (PWM speed, 150)
 *   L298N  IN1 -> D10  (direction A)
 *   L298N  IN2 -> D11  (direction B)
 *   LM393  OUT -> D2   (hardware interrupt INT0, FALLING edge)
 *   DS18B20 DAT -> D5  (OneWire / DallasTemperature)
 *
 * Behaviour:
 *   - Counts tachometer pulses via a hardware interrupt (no polling jitter).
 *   - Reads DS18B20 with fail-safe handling for invalid reads.
 *   - Every 1000 ms (non-blocking, millis()-based) emits one clean JSON line:
 *       {"rpm": 1440.0, "temperature": 28.5, "motorSpeed": 150}
 *     at 9600 baud — exactly one line per second, parseable by hardware/main.py.
 */

#include <OneWire.h>
#include <DallasTemperature.h>

// ───────────────────────────── Pin assignments ─────────────────────────────
const uint8_t PIN_ENA      = 9;   // L298N enable  -> PWM speed
const uint8_t PIN_IN1      = 10;  // L298N input 1 -> direction
const uint8_t PIN_IN2      = 11;  // L298N input 2 -> direction
const uint8_t PIN_TACH     = 2;   // LM393 OUT -> INT0 hardware interrupt
const uint8_t PIN_DS18B20  = 5;   // DS18B20 data (OneWire)

const int MOTOR_SPEED      = 150; // PWM duty cycle 0–255
const uint8_t DIR_FORWARD  = HIGH; // IN1/IN2 logic for forward rotation

// ─────────────────────────── Hardware interrupt ────────────────────────────
// ISR must stay tiny and must not call blocking / floating-point code.
// It only bumps a counter; the loop converts count -> RPM once per second.
volatile unsigned long g_pulseCount = 0;

void onTachPulse() {
  g_pulseCount++;
}

// ────────────────────────────── Temperature ────────────────────────────────
OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);

// Fail-safe read: returns true and sets *tempC only when the probe answered
// with a physically valid temperature. DS18B20 reports -127.00 when the bus
// is shorted and -999.00 (our sentinel) when the device is missing — both are
// rejected here so garbage never reaches the serial line.
bool readTemperatureSafe(float *tempC) {
  if (!ds18b20.requestTemperatures()) return false; // no device on the bus
  float raw = ds18b20.getTempCByIndex(0);
  if (raw <= -126.9 || raw >= 124.9) return false;   // -127 / +125 sentinels
  if (isnan(raw) || isinf(raw)) return false;
  *tempC = raw;
  return true;
}

// ─────────────────────────────── Setup ─────────────────────────────────────
void setup() {
  Serial.begin(9600);

  pinMode(PIN_ENA, OUTPUT);
  pinMode(PIN_IN1, OUTPUT);
  pinMode(PIN_IN2, OUTPUT);
  pinMode(PIN_TACH, INPUT_PULLUP);

  // Drive the motor: ENA = PWM speed, IN1/IN2 = forward.
  analogWrite(PIN_ENA, MOTOR_SPEED);
  digitalWrite(PIN_IN1, DIR_FORWARD);
  digitalWrite(PIN_IN2, !DIR_FORWARD);

  ds18b20.begin();

  // Attach the falling-edge interrupt AFTER pins/Peripherals are configured.
  // RISING is equally valid for the LM393 (open-collector comparator); the
  // spec calls for FALLING, so one clean count per shutter gap is produced.
  attachInterrupt(digitalPinToInterrupt(PIN_TACH), onTachPulse, FALLING);
}

// ──────────────────────────────── Main loop ────────────────────────────────
unsigned long g_lastWindowMs = 0;

void loop() {
  unsigned long now = millis();

  // Non-blocking 1 s cadence: do everything inside the `if`, never delay().
  if (now - g_lastWindowMs >= 1000UL) {
    const unsigned long windowMs = now - g_lastWindowMs;
    g_lastWindowMs = now;

    // Snapshot the counter, then reset it for the next 1 s window.
    // (Interrupts between the read and the reset are counted in the next
    //  window — they belong to the next second anyway.)
    noInterrupts();
    unsigned long pulses = g_pulseCount;
    g_pulseCount = 0;
    interrupts();

    // RPM = pulses in the window × 60.0 / seconds in the window.
    // With a 1 s window and one shutter pulse per revolution this is simply
    // pulses × 60.0. For tachometers that emit N pulses per revolution,
    // divide by N here (see README).
    const float seconds = windowMs / 1000.0f;
    const float rpm = (pulses * 60.0f) / seconds;

    // The reported PWM is the ARDUINO<->LAPTOP connection signal: as long as
    // the board is streaming it reports the commanded value (150). Connection
    // loss is detected by the frame watchdog on the dashboard, not by the
    // motor's rotation.
    const int reportedSpeed = MOTOR_SPEED;

    // Temperature with fail-safe: null (not -127/-999) when the probe errors.
    float tempC = 0.0f;
    const bool tempOk = readTemperatureSafe(&tempC);

    // ── Clean, sanitised JSON ──
    // Numbers are formatted without scientific notation or NaN/Inf so the
    // Python parser never trips on a corrupt frame. On a probe fault we emit
    // an explicit null and let the backend treat it as "sensor offline".
    // AVR's default printf has no float support (snprintf %f would print '?'),
    // so format numbers with dtostrf into char buffers first, then build JSON.
    char rpmStr[12];
    char tempStr[12];
    dtostrf(rpm, 1, 1, rpmStr);
    if (tempOk) dtostrf(tempC, 1, 2, tempStr);

    char out[96];
    if (tempOk) {
      snprintf(out, sizeof(out),
               "{\"rpm\": %s, \"temperature\": %s, \"motorSpeed\": %d}",
               rpmStr, tempStr, reportedSpeed);
    } else {
      snprintf(out, sizeof(out),
               "{\"rpm\": %s, \"temperature\": null, \"motorSpeed\": %d}",
               rpmStr, reportedSpeed);
    }
    Serial.println(out);
  }
}
