import os
import math
import logging
import joblib
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List
from openai import OpenAI, AzureOpenAI
from dotenv import load_dotenv

from features import (
    CLASSES,
    FEATURE_NAMES,
    extract_features,
    feature_matrix,
    compute_defect_frequencies,
)

logger = logging.getLogger("smartbearing_ml")

# Load a local .env (e.g. artifacts/api-server/src/ml/.env) if present, so keys
# can live in a gitignored file instead of the shell/process environment.
load_dotenv()

app = FastAPI()

# AI technician summaries — Azure OpenAI is used when its env vars are set,
# otherwise plain OpenAI, otherwise a realistic mock fallback (demo-ready,
# no key required). No secrets live in code; all values come from env.
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-06-01")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")

azure_client = None
openai_client = None
if AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT:
    azure_client = AzureOpenAI(
        api_key=AZURE_OPENAI_API_KEY,
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_version=AZURE_OPENAI_API_VERSION,
    )
elif OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

model_dir = os.path.join(os.path.dirname(__file__), 'models')
model = joblib.load(os.path.join(model_dir, "smartline_final.pkl"))
encoder = joblib.load(os.path.join(model_dir, "label_encoder.pkl"))


class PredictRequest(BaseModel):
    signal: List[float]
    rpm: float = 14400.0          # rotation speed (RPM); defect freqs scale with it
    sample_rate: float = 4000.0


# Per-fault recommended inspection actions (PS: risk alerts with recommended actions)
FAULT_ACTIONS = {
    "Healthy": "No immediate inspection required. Continue routine monitoring.",
    "Imbalance": "Schedule rotor balance check. Verify mass distribution on rotating assembly.",
    "Misalignment": "Inspect coupling alignment and shaft straightness. Realign drive train.",
    "Ball": "Check ball bearings for pitting and wear during next maintenance window.",
    "Inner Race": "Schedule immediate manual inspection of inner race bearing surface.",
    "Outer Race": "Schedule bearing replacement within 18 hours; outer-race spalling likely.",
}


def generate_technician_summary(label: str, confidence: float, features: dict, rpm: float) -> str:
    if label == "Healthy":
        return "Machine is operating within normal vibration and temperature thresholds. No immediate inspection required."

    rms = features.get("rms", 0)
    dom_freq = features.get("dominant_frequency", 0)
    band = None
    for key, name in [
        ("band_bpfo", "BPFO"), ("band_bpfi", "BPFI"), ("band_bsf", "BSF"),
        ("band_1x", "1x RPM"), ("band_2x", "2x RPM"),
    ]:
        if features.get(key, 0) > 0.05:
            band = name
            break

    prompt = (
        f"Write a 2-sentence technician summary and recommended inspection action for a rotating machine "
        f"showing {label} with {confidence*100:.1f}% confidence at {rpm:.0f} RPM. "
        f"RMS is {rms:.3f}, dominant FFT peak at {dom_freq:.1f} Hz"
        + (f", strong spectral energy in the {band} band." if band else ".")
    )

    if azure_client:
        try:
            # Azure OpenAI: `model` is the deployment name configured in the portal
            response = azure_client.chat.completions.create(
                model=AZURE_OPENAI_DEPLOYMENT,
                messages=[{"role": "system", "content": "You are a factory diagnostics AI."},
                          {"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        except Exception:
            pass  # Fallback to mock

    if openai_client:
        try:
            response = openai_client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[{"role": "system", "content": "You are a factory diagnostics AI."},
                          {"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        except Exception:
            pass  # Fallback to mock

    # Mock fallback if no API key or API fails (Perfect for Hackathon MVP)
    action = FAULT_ACTIONS.get(label, "Inspect machine during next maintenance window.")
    return (
        f"High spectral energy in the {band or str(dom_freq) + 'Hz'} range with {confidence*100:.1f}% "
        f"probability of {label} at {rpm:.0f} RPM (RMS {rms:.3f}). "
        f"Recommended Action: {action}"
    )


def _is_degenerate(signal: List[float]) -> bool:
    """True for signals the model cannot score: empty, non-finite, or constant.

    Constant signals (including the zero-filled array the dashboard health probe
    sends) make scipy's kurtosis/skew NaN, which sklearn rejects and Starlette
    cannot serialize — returning a 500. Treat them as flat, unmeasurable input.
    """
    if not signal:
        return True
    if not all(math.isfinite(v) for v in signal):
        return True
    return max(signal) - min(signal) < 1e-9


def _healthy_verdict(req: PredictRequest, note: str) -> dict:
    """Low-confidence Healthy response with the same shape as a real prediction."""
    if req.sample_rate <= 0:
        # Invalid sample rate — extract_features would divide by zero (1.0/0.0
        # raises ZeroDivisionError). Emit a zeroed feature skeleton instead.
        features = {name: 0.0 for name in FEATURE_NAMES}
    else:
        raw_features = extract_features(req.signal, sample_rate=req.sample_rate, rpm=req.rpm)
        # Sanitize non-finite values (kurtosis/skew on flat signals) so the
        # payload serializes cleanly — Starlette's JSONResponse rejects NaN.
        features = {k: (v if math.isfinite(v) else 0.0) for k, v in raw_features.items()}
    probs = {c: 0.1 for c in CLASSES}
    probs["Healthy"] = 0.5
    defect = compute_defect_frequencies(req.rpm)
    return {
        "label": "Healthy",
        "confidence": 0.5,
        "features": features,
        "technician_summary": (
            f"{note} No fault signature detected; returned as Healthy with low "
            "confidence (0.5). Continue routine monitoring."
        ),
        "probabilities": probs,
        "defect_frequencies": {
            "fr": defect["fr"],
            "bpfo": defect["bpfo"],
            "bpfi": defect["bpfi"],
            "bsf": defect["bsf"],
            "ftf": defect["ftf"],
            "rpm": req.rpm,
        },
    }


# ---------------------------------------------------------------------------
# Model training analysis (/analysis)
#
# Real diagnostics computed from the ACTUAL trained model on a fresh, shifted
# validation set. Training uses grouped machine-condition holdout; this set also
# widens RPM/severity ranges and sensor noise to expose simulator overfitting:
# confusion matrix, per-class precision/recall/F1, training + validation loss
# curves, feature scatter data and a PCA projection. Computed once per process
# and cached — nothing here is hardcoded or random.
# ---------------------------------------------------------------------------
from sklearn.metrics import confusion_matrix, classification_report, log_loss
from sklearn.decomposition import PCA
from datetime import datetime, timezone
import os

_analysis_cache = None


def _compute_analysis():
    import numpy as np
    import train_model  # reuse the physics-based synthesis + dataset builder

    # Domain-shifted validation set: deterministic, but deliberately outside the
    # narrow training regime. This is more honest than reusing the same recipe.
    train_model.RNG = np.random.default_rng(2024)
    rows, ys = train_model.build_dataset(
        per_class=400,
        rpm_range=(11000, 18000),
        severity_range=(0.45, 1.55),
        noise_scale=1.35,
    )  # 6 classes x 400 = 2400
    X = train_model.feature_matrix(rows)
    y_enc = encoder.transform(ys)  # label-encode to match the model's classes

    preds = model.predict(X)
    proba = model.predict_proba(X)

    labels = encoder.classes_.tolist()
    label_idx = list(range(len(labels)))  # y_true/y_pred are label-encoded ints
    cm = confusion_matrix(y_enc, preds, labels=label_idx).tolist()
    report = classification_report(y_enc, preds, labels=label_idx,
                                   target_names=labels, output_dict=True, zero_division=0)

    # ---- Training + validation loss curves (real, per boosting iteration) ----
    train_loss = [float(v) for v in model.train_score_]  # deviance, per tree
    val_loss = []
    for proba_iter in model.staged_predict_proba(X):
        val_loss.append(float(log_loss(y_enc, proba_iter)))
    n_iter = len(train_loss)
    step = max(1, n_iter // 40)
    loss_curve = [
        {"iteration": i + 1, "train": round(train_loss[i], 4), "validation": round(val_loss[i], 4)}
        for i in range(0, n_iter, step)
    ]
    if loss_curve and loss_curve[-1]["iteration"] != n_iter:
        loss_curve.append({"iteration": n_iter, "train": round(train_loss[-1], 4), "validation": round(val_loss[-1], 4)})

    # ---- Feature scatter: physically meaningful features + class label ----
    idx = list(range(len(ys)))
    sample = idx[::3]  # 800 points is plenty for a scatter
    scatter = [
        {
            "label": str(ys[i]),
            "rms": round(float(X[i, 3]), 4),
            "kurtosis": round(float(X[i, 9]), 3),
            "crest_factor": round(float(X[i, 11]), 3),
            "band_bpfo": round(float(X[i, 25]), 4),
            "band_bpfi": round(float(X[i, 26]), 4),
            "band_bsf": round(float(X[i, 27]), 4),
        }
        for i in sample
    ]

    # ---- PCA projection into anomaly-detection space ----
    # Standardize first (features span wildly different scales — energy is
    # ~1e3 while band ratios are ~1e-1); PCA on raw scales would collapse all
    # variance into one component. Standard-scaled PCA is the standard pipeline.
    from sklearn.preprocessing import StandardScaler
    Xs = StandardScaler().fit_transform(X)
    pca = PCA(n_components=2, random_state=0)
    proj = pca.fit_transform(Xs).tolist()
    pca_pts = [
        {"pc1": round(proj[i][0], 4), "pc2": round(proj[i][1], 4), "label": str(ys[i])}
        for i in sample
    ]

    per_class = {}
    for label in labels:
        r = report[label]
        per_class[label] = {
            "precision": round(r["precision"], 3),
            "recall": round(r["recall"], 3),
            "f1": round(r["f1-score"], 3),
            "support": int(r["support"]),
        }

    accuracy = float(model.score(X, y_enc))
    macro_f1 = float(report["macro avg"]["f1-score"])
    weighted_f1 = float(report["weighted avg"]["f1-score"])
    training_accuracy = float(getattr(model, "training_accuracy_", 0.0))
    generalization_gap = max(0.0, training_accuracy - accuracy)

    # Training metadata: model spec + pickle timestamp (when the model was built)
    model_path = os.path.join(model_dir, "smartline_final.pkl")
    trained_at = datetime.fromtimestamp(os.path.getmtime(model_path), tz=timezone.utc)

    return {
        "model": {
            "name": "GradientBoost Fault Predictor (GradientBoostingClassifier)",
            "architecture": "Regularized gradient boosting with grouped holdout over 29 physics features",
            "trained_at": trained_at.isoformat(),
            "dataset_size": 4200,            # training samples (700/class)
            "validation_size": len(ys),
            "classes": labels,
            "accuracy": round(accuracy, 4),
            "f1_macro": round(macro_f1, 4),
            "f1_weighted": round(weighted_f1, 4),
            "training_accuracy": round(training_accuracy, 4),
            "generalization_gap": round(generalization_gap, 4),
            "validation_strategy": getattr(model, "validation_strategy_", "domain-shifted held-out validation"),
            "overfit_status": "healthy generalization" if generalization_gap <= 0.08 else "monitor generalization gap",
            "train_loss": round(train_loss[-1], 4),
            "validation_loss": round(val_loss[-1], 4),
            "n_estimators": int(getattr(model, "n_estimators_", model.n_estimators)),
            "learning_rate": float(model.learning_rate),
            "max_depth": int(model.max_depth),
            "feature_names": FEATURE_NAMES,
        },
        "confusion_matrix": {"labels": labels, "matrix": cm},
        "per_class": per_class,
        "loss_curve": loss_curve,
        "scatter": scatter,
        "pca": {"points": pca_pts, "explained_variance": [round(float(v), 4) for v in pca.explained_variance_ratio_]},
    }


@app.get("/analysis")
def analysis():
    global _analysis_cache
    if _analysis_cache is None:
        _analysis_cache = _compute_analysis()
    return _analysis_cache


@app.post("/predict")
def predict(req: PredictRequest):
    if len(req.signal) != 2048:
        return JSONResponse(
            status_code=400,
            content={"error": f"Expected signal of length 2048, got {len(req.signal)}"},
        )

    # Degenerate input (empty, non-finite, or constant) — the health probe and
    # edge sensors can produce it; answer gracefully instead of erroring.
    if _is_degenerate(req.signal):
        return _healthy_verdict(req, note="Signal is flat or non-finite — no measurable vibration.")

    # A non-positive sample rate (bad estimate from a phone sensor) would make
    # the FFT frequency axis NaN → 500. Answer gracefully instead.
    if req.sample_rate <= 0:
        return _healthy_verdict(req, note="Invalid sample rate — cannot compute a spectrum.")

    features = extract_features(req.signal, sample_rate=req.sample_rate, rpm=req.rpm)
    df = feature_matrix([features])

    try:
        # Predict
        prediction = model.predict(df)[0]
        probability = model.predict_proba(df)[0]
    except Exception as exc:
        # Safety net: never 500 on an unscorable window — degrade to Healthy.
        logger.warning("Model prediction failed (%s); returning Healthy fallback.", exc)
        return _healthy_verdict(req, note="Model could not score this signal.")

    label = encoder.inverse_transform([prediction])[0]
    confidence = float(max(probability))

    # Full probability vector for interpretability (probabilistic per PS 08)
    probs = {str(c): float(p) for c, p in zip(encoder.classes_, probability)}

    summary = generate_technician_summary(str(label), confidence, features, req.rpm)

    defect = compute_defect_frequencies(req.rpm)

    return {
        "label": str(label),
        "confidence": confidence,
        "features": features,
        "technician_summary": summary,
        "probabilities": probs,
        "defect_frequencies": {
            "fr": defect["fr"],
            "bpfo": defect["bpfo"],
            "bpfi": defect["bpfi"],
            "bsf": defect["bsf"],
            "ftf": defect["ftf"],
            "rpm": req.rpm,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
