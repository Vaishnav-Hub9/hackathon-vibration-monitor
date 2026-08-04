"""
Shared feature extraction + bearing defect-frequency math.

Single source of truth used by BOTH:
  * train_model.py  (synthesizes 6-class training data, trains the classifier)
  * server.py       (serves /predict at runtime)

Only numpy/scipy are required (no pandas, no pywt, no xgboost) so the ML
server is cheap to install and run.

Defect frequencies are computed from bearing geometry + live RPM using the
classic ISO-style formulas:

    BPFO = (N/2) * f_r * (1 - (d/D) * cos(a))     ball pass outer race
    BPFI = (N/2) * f_r * (1 + (d/D) * cos(a))     ball pass inner race
    BSF  = (D/(2d)) * f_r * (1 - ((d/D) * cos(a))^2)
    FTF  = (f_r/2) * (1 - (d/D) * cos(a))         fundamental train freq

where N = ball count, D = pitch diameter, d = ball diameter, a = contact
angle, f_r = RPM/60 (rotating frequency).
"""
import numpy as np
from scipy.stats import kurtosis, skew
from scipy.fft import fft

# Default bearing geometry (6205-class deep-groove ball bearing, mm + deg)
DEFAULT_GEOMETRY = {
    "balls": 9,
    "pitch_diameter": 39.04,
    "ball_diameter": 7.94,
    "contact_angle": 0.0,
}

# Labels the model distinguishes (matches Problem Statement 08 classes:
# healthy / bearing fault (ball, inner, outer) / imbalance / misalignment)
CLASSES = ["Healthy", "Imbalance", "Misalignment", "Ball", "Inner Race", "Outer Race"]


def compute_defect_frequencies(rpm, geometry=None):
    """Return dict of defect frequencies (Hz) for a given rotation speed."""
    g = dict(DEFAULT_GEOMETRY)
    if geometry:
        g.update(geometry)
    fr = rpm / 60.0
    c = np.cos(np.radians(g["contact_angle"]))
    ratio = g["ball_diameter"] / g["pitch_diameter"]
    bpfo = (g["balls"] / 2.0) * fr * (1 - ratio * c)
    bpfi = (g["balls"] / 2.0) * fr * (1 + ratio * c)
    bsf = (g["pitch_diameter"] / (2.0 * g["ball_diameter"])) * fr * (1 - (ratio * c) ** 2)
    ftf = (fr / 2.0) * (1 - ratio * c)
    return {
        "fr": fr,          # 1x rotating frequency
        "bpfo": bpfo,
        "bpfi": bpfi,
        "bsf": bsf,
        "ftf": ftf,
    }


def _fft_spectrum(window, sample_rate):
    """Single-sided magnitude spectrum + frequency axis (Hz)."""
    n = len(window)
    mags = np.abs(fft(window))[: n // 2]
    freqs = np.fft.fftfreq(n, 1.0 / sample_rate)[: n // 2]
    return freqs, mags


def _band_ratio(freqs, mags, center, harmonics=3, width_pct=0.1):
    """Fraction of total spectral energy sitting on `center` + its harmonics."""
    total = np.sum(mags) + 1e-12
    energy = 0.0
    for h in range(1, harmonics + 1):
        lo = center * h * (1 - width_pct)
        hi = center * h * (1 + width_pct)
        mask = (freqs >= lo) & (freqs <= hi)
        energy += np.sum(mags[mask])
    return float(energy / total)


def extract_features(window, sample_rate=4000.0, rpm=14400.0, geometry=None):
    """Numpy/scipy-only feature dict (order preserved; see FEATURE_NAMES)."""
    window = np.asarray(window, dtype=np.float64)
    feats = {}

    # ---- Time domain ----
    feats["mean"] = float(np.mean(window))
    feats["std"] = float(np.std(window))
    feats["variance"] = float(np.var(window))
    feats["rms"] = float(np.sqrt(np.mean(window ** 2)))
    feats["max"] = float(np.max(window))
    feats["min"] = float(np.min(window))
    feats["peak_to_peak"] = float(np.ptp(window))
    feats["mean_abs"] = float(np.mean(np.abs(window)))
    feats["energy"] = float(np.sum(window ** 2))
    feats["kurtosis"] = float(kurtosis(window))
    feats["skewness"] = float(skew(window))

    peak = np.max(np.abs(window))
    rms = feats["rms"]
    mean_abs = feats["mean_abs"]
    feats["crest_factor"] = peak / rms if rms != 0 else 0.0
    feats["shape_factor"] = rms / mean_abs if mean_abs != 0 else 0.0
    feats["impulse_factor"] = peak / mean_abs if mean_abs != 0 else 0.0
    margin_denom = float(np.mean(np.sqrt(np.abs(window)))) ** 2
    feats["margin_factor"] = peak / margin_denom if margin_denom != 0 else 0.0

    # ---- Frequency domain ----
    freqs, mags = _fft_spectrum(window, sample_rate)
    feats["fft_mean"] = float(np.mean(mags))
    feats["fft_std"] = float(np.std(mags))
    feats["fft_max"] = float(np.max(mags))
    feats["fft_energy"] = float(np.sum(mags ** 2))
    dom_idx = int(np.argmax(mags))
    feats["dominant_frequency"] = float(freqs[dom_idx])          # Hz (not a bin index)
    feats["dominant_amplitude"] = float(mags[dom_idx])

    fft_sum = np.sum(mags) + 1e-12
    spectral_prob = mags / fft_sum
    feats["spectral_entropy"] = float(-np.sum(spectral_prob * np.log2(spectral_prob + 1e-12)))
    feats["spectral_centroid"] = float(np.sum(freqs * mags) / fft_sum)

    # ---- Defect-frequency band energy ratios (the discriminative features) ----
    df = compute_defect_frequencies(rpm, geometry)
    feats["band_1x"] = _band_ratio(freqs, mags, df["fr"])
    feats["band_2x"] = _band_ratio(freqs, mags, 2 * df["fr"])
    feats["band_bpfo"] = _band_ratio(freqs, mags, df["bpfo"])
    feats["band_bpfi"] = _band_ratio(freqs, mags, df["bpfi"])
    feats["band_bsf"] = _band_ratio(freqs, mags, df["bsf"])
    feats["band_ftf"] = _band_ratio(freqs, mags, df["ftf"])

    return feats


# Canonical column order for the model — MUST match between training & serving.
FEATURE_NAMES = [
    "mean", "std", "variance", "rms", "max", "min", "peak_to_peak", "mean_abs",
    "energy", "kurtosis", "skewness", "crest_factor", "shape_factor",
    "impulse_factor", "margin_factor", "fft_mean", "fft_std", "fft_max",
    "fft_energy", "dominant_frequency", "dominant_amplitude", "spectral_entropy",
    "spectral_centroid", "band_1x", "band_2x", "band_bpfo", "band_bpfi",
    "band_bsf", "band_ftf",
]


def feature_matrix(feature_dicts):
    """Convert a list of feature dicts into the (n, f) numpy matrix."""
    return np.array([[d[k] for k in FEATURE_NAMES] for d in feature_dicts], dtype=np.float64)
