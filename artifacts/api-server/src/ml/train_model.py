"""
Train the 6-class rotating-machinery fault classifier.

Synthesizes vibration windows for each of the classes the Problem Statement
names — Healthy, Imbalance, Misalignment, Ball, Inner Race, Outer Race — using
physically-motivated spectral signatures:

  * Imbalance      -> strong 1x RPM component
  * Misalignment   -> strong 2x RPM component
  * Outer Race     -> BPFO + harmonics
  * Inner Race     -> BPFI + harmonics
  * Ball           -> BSF + harmonics

Defect frequencies are computed from bearing geometry + RPM (features.py), so
training and live inference always agree. Outputs the same two joblib pickles
the FastAPI server loads: smartline_final.pkl + label_encoder.pkl.

Runs with only: numpy, scipy, scikit-learn, joblib.
"""
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report
import joblib
import os

from features import (
    extract_features,
    feature_matrix,
    compute_defect_frequencies,
    CLASSES,
)

N_SAMPLES = 2048
SAMPLE_RATE = 4000.0
RNG = np.random.default_rng(42)


def synthesize(label, rpm, severity=1.0):
    """Build one 2048-sample vibration window for a fault class."""
    df = compute_defect_frequencies(rpm)
    t = np.arange(N_SAMPLES) / SAMPLE_RATE
    fr = df["fr"]

    sig = RNG.normal(0, 0.05, N_SAMPLES)  # broadband noise floor

    def tone(freq, amp):
        return amp * np.sin(2 * np.pi * freq * t + RNG.uniform(0, 2 * np.pi))

    # Every machine has a small 1x fundamental (rotor)
    sig += tone(fr, 0.35 * severity)

    if label == "Healthy":
        pass
    elif label == "Imbalance":
        sig += tone(fr, 1.6 * severity)
        sig += tone(2 * fr, 0.15 * severity)  # small 2x from modulation
    elif label == "Misalignment":
        sig += tone(fr, 0.5 * severity)
        sig += tone(2 * fr, 1.8 * severity)
        sig += tone(4 * fr, 0.3 * severity)
    elif label == "Outer Race":
        for h in (1, 2, 3):
            sig += tone(df["bpfo"] * h, (1.3 / h) * severity)
        sig += tone(fr, 0.2 * severity)
    elif label == "Inner Race":
        for h in (1, 2, 3):
            sig += tone(df["bpfi"] * h, (1.3 / h) * severity)
        sig += tone(fr, 0.25 * severity)
    elif label == "Ball":
        for h in (1, 2, 3):
            sig += tone(df["bsf"] * h, (1.3 / h) * severity)
        sig += tone(fr, 0.2 * severity)
    else:
        raise ValueError(f"Unknown label {label}")

    return sig


def build_dataset(per_class=700):
    rows, ys = [], []
    for label in CLASSES:
        for _ in range(per_class):
            rpm = float(RNG.integers(13500, 16500))  # ~14-16k RPM spindles
            severity = float(RNG.uniform(0.7, 1.3))
            sig = synthesize(label, rpm, severity)
            feats = extract_features(sig, sample_rate=SAMPLE_RATE, rpm=rpm)
            rows.append(feats)
            ys.append(label)
    return rows, np.array(ys)


def main():
    rows, y = build_dataset()
    X = feature_matrix(rows)
    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.25, random_state=7, stratify=y_enc
    )

    clf = GradientBoostingClassifier(
        n_estimators=220,
        learning_rate=0.08,
        max_depth=4,
        random_state=7,
    )
    clf.fit(X_train, y_train)

    acc = clf.score(X_test, y_test)
    print(f"Test accuracy: {acc:.3f}")
    print(
        classification_report(
            y_test,
            clf.predict(X_test),
            target_names=le.classes_.tolist(),
            zero_division=0,
        )
    )

    model_dir = os.path.join(os.path.dirname(__file__), "models")
    os.makedirs(model_dir, exist_ok=True)
    joblib.dump(clf, os.path.join(model_dir, "smartline_final.pkl"))
    joblib.dump(le, os.path.join(model_dir, "label_encoder.pkl"))
    print(f"Saved model + encoder to {model_dir}")


if __name__ == "__main__":
    main()
