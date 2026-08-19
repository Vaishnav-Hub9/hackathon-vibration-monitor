/*
 * wiring_test.ino — SmartBearing rig HARDWARE SELF-TEST
 * ─────────────────────────────────────────────────────
 * A diagnostic sketch for the Arduino IDE: flash it, open the Serial Monitor
 * at 9600 baud, and it checks every subsystem of the rig in about 10 seconds,
 * printing a PASS/FAIL verdict for each so wiring faults are easy to find.
 *
 * Wiring under test (see hardware/README.md):
 *   L298N  ENA -> D9  ·  IN1 -> D10  ·  IN2 -> D11
 *   LM393  OUT -> D2  (hardware interrupt INT0, FALLING)
 *   DS18B20 DATA -> D4 (OneWire / DallasTemperature)
 *
 * After the report it idles; type 'r' + Enter in the Serial Monitor to re-run,
 * or '0' to park. Flash motor_monitor.ino afterwards to return to live mode.
 */

#include <OneWire.h>
#include <DallasTemperature.h>

const uint8_t PIN_ENA     = 9;   // L298N enable  -> PWM speed
const uint8_t PIN_IN1     = 10;  // L298N input 1 -> direction
const uint8_t PIN_IN2     = 11;  // L298N input 2 -> direction
const uint8_t PIN_TACH    = 2;   // LM393 OUT -> INT0
const uint8_t PIN_DS18B20 = 5;   // DS18B20 data

const int MOTOR_SPEED = 150;     // PWM duty cycle 0-255

volatile unsigned long g_pulses = 0;

void onTachPulse() {
  g_pulses++;
}

OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);

void printAddress(const uint8_t *addr) {
  for (uint8_t i = 0; i < 8; i++) {
    if (addr[i] < 16) Serial.print('0');
    Serial.print(addr[i], HEX);
  }
}

// ── 1. Motor driver: drive ENA/IN1/IN2 and tell the user what to verify ──
void testMotorDriver() {
  pinMode(PIN_ENA, OUTPUT);
  pinMode(PIN_IN1, OUTPUT);
  pinMode(PIN_IN2, OUTPUT);
  analogWrite(PIN_ENA, MOTOR_SPEED);
  digitalWrite(PIN_IN1, HIGH);
  digitalWrite(PIN_IN2, LOW);

  Serial.println(F("[1] MOTOR DRIVER (L298N)"));
  Serial.print(F("    Driving ENA=D9 PWM "));
  Serial.print(MOTOR_SPEED);
  Serial.println(F(", IN1=D10 HIGH, IN2=D11 LOW"));
  Serial.println(F("    => If the motor isn't turning, check: 12V on L298N +12V,"));
  Serial.println(F("       motor wires on OUT1/OUT2, shared GND, ENA jumper/PWM."));
  Serial.println(F("    (Auto-verified by the tach test below when 12V is on.)"));
}

// ── 2. Tachometer: count FALLING-edge interrupts for 5 seconds ──
void testTachometer() {
  pinMode(PIN_TACH, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_TACH), onTachPulse, FALLING);

  Serial.println(F("\n[2] TACHOMETER (LM393 on D2 / INT0, FALLING)"));
  Serial.println(F("    Spin the shaft by hand (or run the motor) for 5 s..."));

  g_pulses = 0;
  unsigned long start = millis();
  while (millis() - start < 5000UL) {
    // ISR counts in the background; nothing to do here.
  }
  unsigned long pulses;
  noInterrupts();
  pulses = g_pulses;
  g_pulses = 0;
  interrupts();

  Serial.print(F("    Pulses counted in 5 s: "));
  Serial.println(pulses);
  if (pulses >= 2) {
    Serial.println(F("    => PASS: beam interrupts detected (sensor, power and disc"));
    Serial.println(F("       alignment all look good). Motor+driver also proven if the"));
    Serial.println(F("       shaft turned on its own."));
  } else {
    Serial.println(F("    => FAIL: no pulses arrived. Check LM393 VCC->5V, GND->GND,"));
    Serial.println(F("       OUT->D2, and that the shutter disc passes through the"));
    Serial.println(F("       opto slot. If the motor didn't spin either, see [1]."));
  }
}

// ── 3. DS18B20: scan the OneWire bus, report devices + a live reading ──
void testDs18b20() {
  Serial.println(F("\n[3] DS18B20 TEMPERATURE (OneWire on D5)"));
  ds18b20.begin();

  const int n = ds18b20.getDeviceCount();
  Serial.print(F("    Devices found on the OneWire bus: "));
  Serial.println(n);

  if (n > 0) {
    uint8_t addr[8];
    if (ds18b20.getAddress(addr, 0)) {
      Serial.print(F("    ROM address: "));
      printAddress(addr);
      Serial.println();
      ds18b20.setResolution(addr, 12);
    }
    ds18b20.requestTemperatures();
    const float t = ds18b20.getTempCByIndex(0);
    if (t > -126.0f) {
      Serial.print(F("    Live temperature: "));
      Serial.print(t, 2);
      Serial.println(F(" C  => PASS (probe answering). Touch it: the value should move."));
    } else {
      Serial.println(F("    Read failed (-127): sensor answers the bus but reads bad."));
      Serial.println(F("    => Check the 4.7k pull-up between DATA and VCC."));
    }
  } else {
    Serial.println(F("    => FAIL: no DS18B20 responded. In order, check:"));
    Serial.println(F("       a) +5V on VCC (Arduino 5V, or L298N +5V only once the"));
    Serial.println(F("          12V rail is connected AND its 5V jumper is fitted)"));
    Serial.println(F("       b) DATA wire on D5 (not D2/D3/D12/D13)"));
    Serial.println(F("       c) 4.7k pull-up resistor between DATA and VCC"));
    Serial.println(F("          (breakout boards include it; bare probes don't)"));
    Serial.println(F("       d) GND tied to the common ground with the Arduino"));
  }
}

void runSelfTest() {
  Serial.println(F("\n=============================================="));
  Serial.println(F("  SmartBearing rig HARDWARE SELF-TEST"));
  Serial.println(F("  Board: Arduino Uno"));
  Serial.println(F("=============================================="));
  testMotorDriver();
  testTachometer();
  testDs18b20();
  Serial.println(F("\n=== Done. 'r' + Enter re-runs the test, '0' parks. ==="));
}

void setup() {
  Serial.begin(9600);
  while (!Serial) { /* wait for USB serial (Leonardo-class) */ }
  delay(300);
  runSelfTest();
}

void loop() {
  if (Serial.available() > 0) {
    const char c = Serial.read();
    if (c == 'r' || c == 'R') runSelfTest();
  }
  delay(50);
}
