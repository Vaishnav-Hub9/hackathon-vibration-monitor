# SmartBearing — A Conceptual Walkthrough

*Companion to `DEMO.md` (the judge-facing runbook). This document explains
**why** the project works: the physics of bearings, the language of vibration,
the ML model, and how data flows through the system — in plain words, no jargon.*

---

## 1. The problem this project solves

Imagine a textile mill. A "ring frame" is a machine with **400 spindles** — 400
tiny spinning shafts, each wrapped with thread. Each spindle rides on a **ball
bearing** the size of a large marble. The spindle spins at **12,000–15,000
revolutions per minute** (RPM) — that's 200–250 turns *every second*.

Now imagine one of those bearings is wearing out. It doesn't just explode
instantly — it degrades over days or weeks. But here's the trap: by the time
you can *smell* it or *feel* the heat, it's usually too late, and when a
bearing seizes at 15,000 RPM it can destroy the spindle, snap thread across
the whole machine, and stop **400 spindles at once**. That's the ₹53,938
per-incident cost, the 6 hours of downtime, the ruined production shift.

So the entire premise of the project is: **bearings give warning signs before
they die — vibration and sound — and a machine can learn to read those signs
and send help before the failure.**

This is called *predictive maintenance*: not fixing things on a fixed
schedule, and not fixing them after they break, but fixing them at the exact
right moment — when the machine itself starts to whisper "I'm going to fail."

---

## 2. What a bearing actually is (the physics, in plain words)

A ball bearing is a beautifully simple thing:

- The **inner ring** is pressed onto the spinning shaft.
- The **outer ring** is fixed to the machine housing.
- **Steel balls** sit in between, so the metal doesn't rub on metal — they
  roll instead of slide.

The one in this project is a **6205 deep-groove ball bearing**: about 52 mm
across, 9 balls, each ball about 8 mm wide, rolling in a circular track
(pitch diameter ≈ 39 mm) between the rings.

Now — the crucial idea. **When everything is perfect, the balls roll smoothly
and quietly.** When a defect forms — a tiny pit, a flake, a "spall" (a piece
of metal that chips out of a race) — something changes: **every time a ball
rolls over that pit, it drops into it and bounces back out.** That's an
impact. A tiny hammer blow, thousands of times per minute.

Think of a bicycle: put a playing card in the spokes. Every time the wheel
turns, the card hits a spoke — *click, click, click*. The card isn't making
noise continuously; it's making a **pulse at a fixed, repeatable rate**. A
defective bearing is exactly that playing card, except the "clicks" happen
hundreds of times per second, are too quiet to hear with ears, but are loud
enough for a sensitive microphone or accelerometer.

**That repeatable click-rate is the single most important concept in this
project.** Because the defect makes noise at a *specific, predictable
frequency* — and a machine can be taught to recognize that frequency the way
you recognize the rhythm of your favorite song.

---

## 3. The language of motion: frequency, RPM, and harmonics

Everything rotating has a "beat." We measure beats per second in **Hertz
(Hz)**.

- If the shaft turns 15,000 times per minute, that's **15,000 ÷ 60 = 250
  turns per second = 250 Hz**. We call this **1× RPM** — "the turning
  frequency." Every rotating machine has a strong vibration signal at exactly
  this frequency. It's the machine's heartbeat.

Here's the key intuition: **a vibration is not one single beat — it's many
beats layered on top of each other.** The shaft turning at 250 Hz also
produces energy at *double* that (500 Hz = "2× RPM", classic sign of a
misaligned shaft), triple that, and so on. These multiples are called
**harmonics** — the same idea as a guitar string: pluck it and you don't just
hear the base note, you hear quieter copies of it at double and triple the
frequency.

So when a defect forms, the machine's "song" gains a new set of notes. The
project's job: **hear those specific notes and name the fault that produces
them.**

---

## 4. The bearing's four "voices" — BPFO, BPFI, BSF, FTF

This is where the "jargon" comes from, and it's actually simple. Each
*location* of a defect makes its own click-rate, because the geometry of the
rolling changes which part crosses the defect most often:

- **BPFO — Ball Pass Frequency, Outer race.** The defect is on the *outer*
  ring (which is stationary). The balls pass over the pit as they roll. With
  9 balls, the click-rate is roughly 9 × (how fast the balls orbit) — for our
  machine about **896 Hz at 15,000 RPM**. This is the single most common
  bearing-failure signature, and the one the project treats as the alarm
  bell. ("BPFO spike detected" = "a ball is repeatedly hammering a pit on the
  outer ring.")
- **BPFI — Ball Pass Frequency, Inner race.** The defect is on the *inner*
  ring, which is spinning with the shaft. The pit moves too, so the click
  pattern is slightly faster — about **1,354 Hz** here. (Think: the card is
  now taped to a spinning wheel AND the spokes are moving.)
- **BSF — Ball Spin Frequency.** The defect is on one of the *balls*
  themselves. The ball spins about its own axis as it orbits, so the click
  happens at the ball's own spin rate — about **589 Hz**.
- **FTF — Fundamental Train Frequency.** The defect is in the *cage* (the
  little ring that keeps balls evenly spaced). The whole ball "train" orbits
  slowly — about **100 Hz**.

The beautiful part: **all four are computed from simple geometry** — count the
balls, measure the ball diameter and the pitch diameter, know the contact
angle and the RPM — and you get exact numbers. That's the
`compute_defect_frequencies()` function in the code. No guessing; pure
geometry × rotation speed.

And remember the playing-card idea: a pit produces energy not just at BPFO
but at **2×BPFO, 3×BPFO, 4×BPFO** — the harmonics. The more severe the
damage, the stronger these harmonics grow. That's why the model looks at a
*band* of energy around each frequency, not a single perfect note.

---

## 5. How we "hear": sampling, the FFT, and the Nyquist limit

A microphone doesn't produce a smooth waveform — it takes **snapshots** of
the air pressure many thousands of times per second. Each snapshot is a
**sample**. The phone mic takes **44,100 samples per second** (44.1 kHz — CD
quality).

This leads to the single most important rule in all of signal processing —
the **Nyquist limit**:

> **You can only see frequencies up to HALF your sampling rate.**
> Anything faster than that gets "aliased" — it masquerades as a different,
> wrong frequency.

- Phone mic: 44,100 samples/s → can see up to **22,050 Hz**. Our fault
  frequencies (896 Hz, 1,354 Hz…) and their harmonics live far below that. ✅
- Phone accelerometer (the vibration sensor): the operating system only
  delivers **~60–100 samples/s** → can see up to **30–50 Hz**. Our BPFO at
  896 Hz is *invisible* to it — it would appear as a garbled, wrong
  frequency. ❌

That's the physics reason this project uses the **microphone as the primary
sensor**: the accelerometer literally cannot capture the fault signature; the
mic can. The accelerometer is still useful for one thing — the overall
*energy level* (RMS, see below) — but it cannot do spectral analysis. This is
exactly what the "honest note" in the capture app says.

**Now the FFT.** Once we have 2,048 samples (46 milliseconds of sound at
44.1 kHz), we want to know: *which frequencies are present, and how strong is
each?* The **Fast Fourier Transform (FFT)** does exactly this — it's the
mathematical equivalent of a prism: white light in, rainbow out.
Time-signal in, frequency-spectrum out.

The FFT divides the frequency range into tiny slices called **bins**. With a
2,048-point FFT at 44.1 kHz, each bin is about 21.5 Hz wide. "Bin 17" means
"roughly 366 Hz," and so on. The capture app's orange **BPFO marker** line is
literally drawing "here's the bin where BPFO should be, given this machine's
RPM" — and if you see the bars near it jump, the bearing is talking.

---

## 6. The "energy meter": RMS, decibels, and normalization

Two more simple ideas, then we get to the brain.

**RMS** (root-mean-square) is just a smart way to say "how strong is this
vibration on average?" Instead of averaging the up-and-down wobble (which
cancels out to zero), you square every value (making them all positive),
average, then un-square. The result is the "effective strength." This is the
number you see on the dashboard as **Vibration RMS in g** — *g* being units
of gravity (1 g = the pull of Earth's gravity; 3 g means the housing is
shaking with three times the force of gravity).

**Decibels (dB)** are a compressed scale for sound — because the quietest
audible sound and a jackhammer differ by a factor of a trillion, we use a
logarithmic scale instead of raw numbers. The capture app converts the mic's
decibel readings into a 0-to-1 "how loud is this bin" scale for drawing and
scoring.

**Normalization** is the last trick: a phone held close hears louder sound
than a phone held far away, and a microphone's output is far quieter (in
vibration units) than an accelerometer's. So before sending the audio to the
ML model, the app scales the whole window so its RMS equals 1 — like turning
the volume knob until the average level matches. Crucially, this *doesn't*
change *which* frequencies are present — the "shape" of the spectrum (the
fault signature) is preserved; only the volume is standardized. That's why
the model can score a phone's audio even though it was trained on
accelerometer data.

---

## 7. The brain: the ML model

Now the machine "listens." The **ML server** (a Python FastAPI service)
receives the 2,048-sample window plus the RPM. It does two things:

**Step 1 — Extract features.** It reduces 2,048 raw numbers into ~29
meaningful numbers:

- *Time-domain* (looking at the wobble itself): RMS, peak value, **kurtosis**
  (how "spiky" the signal is — a healthy bearing has smooth, Gaussian noise;
  a damaged bearing has sharp hammer-blow spikes), **skewness** (asymmetry),
  **crest factor** (peak ÷ RMS — how extreme the spikes are relative to the
  average).
- *Frequency-domain* (looking at the spectrum): where the strongest peak is,
  and crucially — **how much of the total energy sits in the BPFO/BPFI/BSF/
  1×/2× RPM bands**. These band-energy ratios are the discriminative
  features: energy at BPFO → outer race; energy at 1× RPM → imbalance; energy
  at 2× RPM → misalignment.

**Step 2 — Classify.** A pre-trained classifier (a scikit-learn model, saved
as a file) compares this feature pattern to patterns it learned during
training and outputs **one of 6 verdicts** with a confidence percentage:

| Verdict | The physics behind it |
|---|---|
| **Healthy** | No unusual band energy; smooth noise. |
| **Imbalance** | Strong energy at 1× RPM — mass isn't evenly distributed (like an unbalanced washing machine). |
| **Misalignment** | Strong energy at 2× RPM — shaft isn't straight or couplings are off. |
| **Ball** | Energy at BSF — a ball itself is pitted. |
| **Inner Race** | Energy at BPFI — inner ring is spalled. |
| **Outer Race** | Energy at BPFO — outer ring is spalled. The classic, most urgent one. |

The model was *trained* by synthesizing thousands of signals with known
signatures (the `train_model.py` script generates the exact physics: a
BPFO-spiked signal for "Outer Race," a 1×RPM-dominated signal for
"Imbalance," etc.) so it learned the shapes. At runtime it also produces
per-class probabilities and a **technician summary** — a plain-language
sentence ("High spectral energy in the BPFO range with 100.0% probability of
Outer Race at 15000 RPM… Recommended Action: Schedule bearing replacement
within 18 hours") generated by an LLM, or by a built-in template when no API
key is set.

There's also an important safety behavior: if the input is *degenerate* —
flat, constant, empty, or all zeros (like a machine that's off, or the health
probe) — the model can't score it, and instead of crashing it returns a
low-confidence "Healthy (0.5)" with a note. Scoring something unscoreable as
"Healthy, not sure" is more honest than a red error.

---

## 8. The body: how data flows through the system

Now let's follow data through the whole stack — there are **three sources**
and **one dashboard**:

```
 SOURCES                          BACKEND (Node.js :5001)            BRAIN (Python :8000)
 ┌──────────────┐   POST /api/    ┌─────────────────────┐   relay   ┌──────────────┐
 │ Phone (mic / │── sensor- ────▶ │ validates, stores    │──────────▶│ /predict     │
 │ accelerometer)│   readings     │ in MongoDB, alerts   │◀──────────│ 29 features  │
 └──────────────┘                 │ broadcast via        │  verdict  │ 6 classes    │
 ┌──────────────┐   every 3.5s    │ Socket.io ───────────┼──┐        └──────────────┘
 │ Simulator    │── synthesizes ─▶│                      │  │
 │ (edge nodes) │   + ML scores   │                      │  ▼
 └──────────────┘                 └──────────────────────┴──┼──────────────┐
                                                            │  React dashboard (:5173)
                                                            │  live updates, alerts, charts
                                                            └──────────────┘
```

**The three sources:**

1. **The simulator** — emulates the real edge nodes (₹1,800 sensor modules).
   Every 3.5 seconds it *synthesizes* a 2,048-sample vibration window whose
   spectrum matches each machine's fault profile (real BPFO harmonics for an
   outer-race machine, 1× RPM for an imbalanced one), sends it to the ML
   brain, and streams the verdict to the dashboard. This is what keeps the
   demo alive when no phone is involved — it's the "always-on" heartbeat you
   see updating on screen.

2. **The phone capture PWA** — a standalone app (not part of the React build)
   that uses the phone's real sensors. Two modes:
   - **Audio mode** (primary): 4-second recording of the mic, live FFT bars
     drawn on canvas with the BPFO marker, then a 2,048-sample mic window is
     sent with the RPM. The backend relays it to the ML brain and the verdict
     comes back.
   - **Vibration mode** (optional, honest about its limits): buffers raw
     accelerometer samples until it has 2,048 (takes ~20–34 s because the
     sensor is slow), measures the *true* sample rate from timestamps, and
     sends it too. The app shows a note: the accelerometer's Nyquist limit
     (~30–50 Hz) means the model can only use energy/RMS — the fault-frequency
     bands are out of range. This mode exists to demonstrate the trade-off,
     not to replace audio.

3. **The Fault Injector** — a demo control on the dashboard. You click
   "Outer Race" and it writes a fault profile to a machine; the simulator
   then synthesizes that machine's signature, the *real* model confirms it,
   and the dashboard highlights the verdict — the full loop: inject →
   classify → highlight → restore.

**The backend** does the "paperwork": validates the reading, stores it in
MongoDB (so history/FFT/RUL charts work), creates or escalates alerts, and
pushes everything to the dashboard **live over Socket.io** — a persistent
connection where the server *pushes* updates the instant they happen, instead
of the dashboard having to keep asking. That's why the sensor feed updates
without any page refresh.

**The dashboard** is pure display: it renders whatever the socket pushes. It
was built before the phone integration; the phone data speaks the same
"language" (the same event shape) the dashboard already understood, so zero
frontend changes were needed for the phone path to work.

---

## 9. Alerts, evidence, and calibration

**Alerts** are deduplicated per machine+node: if a node already has an active
critical alert, a new critical reading doesn't spam another one; if the
reading escalates (warning → critical), the old alert is resolved and a new
critical one created. Each alert carries an **evidence pack** — the spectrum
peaks, the RMS/kurtosis/crest values, the exact BPFO/BPFI/BSF numbers the
model used — plus the AI technician assessment. "Every alert is an evidence
pack, not just a red dot" is the demo's line, and it's literally true: you
can click **View Evidence** and see the numbers that triggered it.

**Calibration** solves a real-world measurement problem: every factory has
background noise, and every phone placement is slightly different. The app
lets you record the machine *off* once and store that as the noise floor
("baseline"); afterwards, all readings subtract that floor before scoring, so
a genuinely quiet machine doesn't false-alarm. Plus the "place the phone at a
marked spot" protocol removes placement variance — the biggest source of
error in phone measurements.

---

## 10. What's real, what's simulated, and what's honest

The project is careful about honesty, and you should be too in the demo:

| Claim | Reality |
|---|---|
| ML verdicts on live signals | **Real** — the actual trained model scores actual windows. |
| Vibration + acoustic signatures | **Real physics** — synthesized with true BPFO/BPFI/BSF harmonics. |
| **Temperature** on the dashboard | **Dataset-augmented** — mapped from the fault severity (CWRU research-dataset health stages), not measured. Live temperature would need a ~₹500 Bluetooth thermometer. |
| **Voltage** | **Synthetic** — modeled as Indian grid 220 V ± noise. |
| Phone accelerometer spectra | **Limited by physics** — Nyquist ~30–50 Hz; trend/RMS only. |
| Phone mic spectra | **The real deal** — 44.1 kHz covers all fault harmonics. |
| WhatsApp alerts | **Simulated** in the frontend (endpoint acknowledges; no actual WhatsApp API). |

The one honest caveat that ties it together: the model was trained on
*vibration*, but the phone hears *airborne sound*. These share the same
spectral fingerprints (the housing radiates the same harmonics it vibrates
with), which is why it works — but absolute accuracy depends on placement and
background noise. That's the calibration procedure's whole purpose.

---

## 11. Where everything lives

```
smartbearing-capture/index.html        ← the phone PWA (mic/accel capture, FFT canvas)
artifacts/api-server/src/
  routes/sensorReadings.ts             ← phone ingest + ML relay + alerts + calibration
  simulator/SensorSimulator.ts         ← the 3.5s edge-node emulator
  ml/server.py                         ← the ML brain (FastAPI /predict)
  ml/features.py                       ← the 29 features + bearing-frequency math
  ml/train_model.py                    ← how the model was trained (synthesized physics)
  models/                              ← MongoDB schemas (readings, alerts, machines)
artifacts/smartbearing/src/
  hooks/useRealSensors.ts              ← streams socket updates into the dashboard
  pages/Dashboard.tsx, Alerts.tsx, ... ← the UI
DEMO.md                                ← the judge-facing runbook
CONCEPTS.md                            ← this document
```

---

## 12. The whole thing in one paragraph

A spinning-mill bearing fails with a signature: at a rate set by its geometry
and speed, its damaged surface produces repeated impacts — click-click-click —
at exact frequencies called BPFO/BPFI/BSF. A phone's microphone (sampling
44,100 times a second) captures those clicks; the FFT turns the sound into a
frequency map; a trained model reads the map — energy at 896 Hz means
outer-race damage, energy at the shaft speed means imbalance — and returns a
verdict with confidence and a plain-language recommendation. The backend
stores it, raises an evidence-backed alert, and pushes it live to the
dashboard over a persistent connection, while the WhatsApp simulation
notifies the foreman. The edge nodes do the same thing autonomously every
3.5 seconds. The result: the machine tells you it's failing — with the *name*
of the fault and how urgent it is — days before it takes 400 spindles down
with it.
