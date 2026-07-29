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

app = FastAPI()

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
    
    return {
        "label": str(label),
        "confidence": float(confidence),
        "features": features
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
