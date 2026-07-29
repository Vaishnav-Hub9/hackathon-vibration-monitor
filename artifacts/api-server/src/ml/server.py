import os
import joblib
import numpy as np
import pandas as pd
from scipy.stats import kurtosis, skew
from scipy.fft import fft
import pywt
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from openai import OpenAI

app = FastAPI()

# Optionally set this in environment for actual Azure/OpenAI integration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

model_dir = os.path.join(os.path.dirname(__file__), 'models')
model = joblib.load(os.path.join(model_dir, "smartline_final.pkl"))
encoder = joblib.load(os.path.join(model_dir, "label_encoder.pkl"))

class PredictRequest(BaseModel):
    signal: List[float]

def extract_features(window):
    features = {}
    window = np.array(window)
    
    # Time Domain
    features["mean"] = np.mean(window)
    features["std"] = np.std(window)
    features["variance"] = np.var(window)
    features["rms"] = np.sqrt(np.mean(window**2))
    features["max"] = np.max(window)
    features["min"] = np.min(window)
    features["peak_to_peak"] = np.ptp(window)
    features["mean_abs"] = np.mean(np.abs(window))
    features["energy"] = np.sum(window**2)
    features["kurtosis"] = float(kurtosis(window))
    features["skewness"] = float(skew(window))
    
    # Derived Features
    peak = np.max(np.abs(window))
    rms = features["rms"]
    mean_abs = features["mean_abs"]
    
    features["crest_factor"] = peak / rms if rms != 0 else 0
    features["shape_factor"] = rms / mean_abs if mean_abs != 0 else 0
    features["impulse_factor"] = peak / mean_abs if mean_abs != 0 else 0
    features["margin_factor"] = peak / (np.mean(np.sqrt(np.abs(window)))**2)
    
    # Frequency Domain
    fft_values = np.abs(fft(window))
    fft_half = fft_values[:len(fft_values)//2]
    
    features["fft_mean"] = np.mean(fft_half)
    features["fft_std"] = np.std(fft_half)
    features["fft_max"] = np.max(fft_half)
    features["fft_energy"] = np.sum(fft_half**2)
    features["dominant_frequency"] = np.argmax(fft_half)
    
    spectral_prob = fft_half / np.sum(fft_half)
    spectral_entropy = -np.sum(spectral_prob * np.log2(spectral_prob + 1e-12))
    
    features["spectral_entropy"] = spectral_entropy
    features["spectral_centroid"] = np.sum(np.arange(len(fft_half)) * fft_half) / np.sum(fft_half)
    
    return features

def extract_wavelet_features(signal):
    coeffs = pywt.wavedec(signal, 'db4', level=4)
    features = {}
    for i, coeff in enumerate(coeffs):
        features[f'wavelet_mean_{i}'] = np.mean(coeff)
        features[f'wavelet_std_{i}'] = np.std(coeff)
        features[f'wavelet_energy_{i}'] = np.sum(coeff**2)
    return features

def generate_technician_summary(label: str, confidence: float, features: dict) -> str:
    if label == "Healthy":
        return "Machine is operating within normal vibration and temperature thresholds. No immediate inspection required."
        
    rms = features.get("rms", 0)
    fft_dom = features.get("dominant_frequency", 0)
    
    if client:
        try:
            prompt = f"Write a 2-sentence technician summary and recommendation for a rotating machine showing {label} with {confidence*100:.1f}% confidence. RMS is {rms:.3f}, dominant FFT peak is at index {fft_dom}."
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "system", "content": "You are a factory diagnostics AI."}, 
                          {"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
        except Exception as e:
            pass # Fallback to mock

    # Mock fallback if no API key or API fails (Perfect for Hackathon MVP)
    action = "Schedule immediate manual inspection of inner race bearings." if "Inner" in label else "Check ball bearings for pitting and wear during next shift."
    return f"High vibration detected in the {fft_dom * 7}Hz FFT range. {confidence*100:.1f}% probability of {label} wear. Recommended Action: {action}"

@app.post("/predict")
def predict(req: PredictRequest):
    if len(req.signal) != 2048:
        return {"error": f"Expected signal of length 2048, got {len(req.signal)}"}
    
    features = extract_features(req.signal)
    wavelet = extract_wavelet_features(req.signal)
    features.update(wavelet)
    
    df = pd.DataFrame([features])
    
    # Predict
    prediction = model.predict(df)[0]
    probability = model.predict_proba(df)[0]
    
    label = encoder.inverse_transform([prediction])[0]
    confidence = np.max(probability)
    
    summary = generate_technician_summary(str(label), float(confidence), features)
    
    return {
        "label": str(label),
        "confidence": float(confidence),
        "features": features,
        "technician_summary": summary
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
