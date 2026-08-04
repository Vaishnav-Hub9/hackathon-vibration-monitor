import os
import joblib
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from openai import OpenAI, AzureOpenAI
from dotenv import load_dotenv

from features import (
    extract_features,
    feature_matrix,
    compute_defect_frequencies,
)

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


@app.post("/predict")
def predict(req: PredictRequest):
    if len(req.signal) != 2048:
        return {"error": f"Expected signal of length 2048, got {len(req.signal)}"}

    features = extract_features(req.signal, sample_rate=req.sample_rate, rpm=req.rpm)
    df = feature_matrix([features])

    # Predict
    prediction = model.predict(df)[0]
    probability = model.predict_proba(df)[0]

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
