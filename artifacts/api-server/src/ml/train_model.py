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
from sklearn.model_selection import GroupShuffleSplit
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


def synthesize(label, rpm, severity=1.0, noise_scale=1.0, sensor_gain=1.0):
    """Build one 2048-sample vibration window for a fault class."""
    df = compute_defect_frequencies(rpm)
    t = np.arange(N_SAMPLES) / SAMPLE_RATE
    fr = df["fr"]

    # Vary sensor noise, gain, phase, detuning, and low-frequency drift so the
    # classifier cannot memorize one clean simulator signature.
    sig = RNG.normal(0, 0.05 * noise_scale, N_SAMPLES)
    sig += 0.015 * noise_scale * np.sin(2 * np.pi * RNG.uniform(0.2, 1.2) * t + RNG.uniform(0, 2 * np.pi))

    def tone(freq, amp):
        detuned = freq * (1 + RNG.normal(0, 0.0025))
        return amp * np.sin(2 * np.pi * detuned * t + RNG.uniform(0, 2 * np.pi))

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

    return sig * sensor_gain


def build_dataset(per_class=700, rpm_range=(13500, 16500), severity_range=(0.7, 1.3), noise_scale=1.0):
    rows, ys = [], []
    for label in CLASSES:
        for _ in range(per_class):
            rpm = float(RNG.integers(rpm_range[0], rpm_range[1]))
            severity = float(RNG.uniform(severity_range[0], severity_range[1]))
            gain = float(RNG.uniform(0.85, 1.15))
            sig = synthesize(label, rpm, severity, noise_scale=noise_scale * RNG.uniform(0.9, 1.1), sensor_gain=gain)
            feats = extract_features(sig, sample_rate=SAMPLE_RATE, rpm=rpm)
            rows.append(feats)
            ys.append(label)
    return rows, np.array(ys)


def build_grouped_dataset(per_class=700, group_size=7):
    """Build windows in machine-condition groups for leakage-free holdout."""
    rows, ys, groups = [], [], []
    for label in CLASSES:
        group_count = int(np.ceil(per_class / group_size))
        for group_index in range(group_count):
            rpm = float(RNG.integers(13500, 16500))
            severity = float(RNG.uniform(0.7, 1.3))
            gain = float(RNG.uniform(0.85, 1.15))
            for _ in range(min(group_size, per_class - group_index * group_size)):
                sig = synthesize(
                    label,
                    rpm,
                    severity * RNG.uniform(0.96, 1.04),
                    noise_scale=RNG.uniform(0.9, 1.2),
                    sensor_gain=gain * RNG.uniform(0.98, 1.02),
                )
                rows.append(extract_features(sig, sample_rate=SAMPLE_RATE, rpm=rpm))
                ys.append(label)
                groups.append(f"{label}-{group_index}")
    return rows, np.array(ys), np.array(groups)


def main():
    rows, y, groups = build_grouped_dataset()
    X = feature_matrix(rows)
    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    # Keep every machine-condition group together. Random row splitting lets
    # near-identical windows leak between train and validation and inflates
    # scores for synthetic datasets.
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=7)
    train_idx, test_idx = next(splitter.split(X, y_enc, groups=groups))
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y_enc[train_idx], y_enc[test_idx]

    clf = GradientBoostingClassifier(
        n_estimators=180,
        learning_rate=0.05,
        max_depth=2,
        min_samples_leaf=8,
        subsample=0.8,
        max_features='sqrt',
        n_iter_no_change=15,
        validation_fraction=0.15,
        tol=1e-4,
        random_state=7,
    )
    clf.fit(X_train, y_train)

    acc = clf.score(X_test, y_test)
    train_acc = clf.score(X_train, y_train)
    clf.training_accuracy_ = float(train_acc)
    clf.validation_accuracy_ = float(acc)
    clf.validation_strategy_ = 'grouped machine-condition holdout'
    clf.generalization_gap_ = float(train_acc - acc)
    print(f"Test accuracy: {acc:.3f}")
    print(f"Train accuracy: {train_acc:.3f}")
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
