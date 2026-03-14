"""
Prediction Service
===================
Loads the trained ML model and encoders, preprocesses incoming
API requests, and returns the top-3 crop recommendations
with confidence scores.

This service is designed to be used by the FastAPI route handler.
"""

import os
import logging
from typing import List, Dict, Any, Optional

import numpy as np
import joblib

# ─── Logger ──────────────────────────────────────────────────────────
logger = logging.getLogger(__name__)

# ─── Paths ───────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "models")

MODEL_PATH   = os.path.join(MODEL_DIR, "crop_model.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "encoder.pkl")
META_PATH    = os.path.join(MODEL_DIR, "model_meta.pkl")

# ─── Crop category mapping (must match preprocess.py) ────────────────
CROP_CATEGORY_MAP: Dict[str, int] = {}   # populated at load time
CATEGORY_NAMES = [
    "commercial", "fruits", "grains", "oilseeds", "other",
    "pulses", "vegetables",
]


class CropPredictor:
    """
    Singleton-style prediction service.
    
    Loads model artifacts once, then serves predictions.
    Thread-safe for FastAPI's async model.
    """

    def __init__(self):
        self.model = None
        self.encoders = None
        self.meta = None
        self._loaded = False

    # ─── Lifecycle ───────────────────────────────────────────

    def load(self) -> None:
        """Load model, encoders, and metadata from disk."""
        if self._loaded:
            return

        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model not found at {MODEL_PATH}. "
                "Run 'python ml/train_model.py' first."
            )

        logger.info("Loading ML model from %s", MODEL_PATH)
        self.model = joblib.load(MODEL_PATH)
        self.encoders = joblib.load(ENCODER_PATH)
        self.meta = joblib.load(META_PATH)
        self._loaded = True

        # Build the category encoding lookup
        if "crop_category" in self.encoders:
            le = self.encoders["crop_category"]
            for idx, cls in enumerate(le.classes_):
                CROP_CATEGORY_MAP[cls] = idx

        logger.info(
            "Model loaded: %s (accuracy=%.4f, %d classes)",
            self.meta["model_name"],
            self.meta["accuracy"],
            self.meta["n_classes"],
        )

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    # ─── Preprocessing ───────────────────────────────────────

    def _encode_crop_category(self, category: str) -> int:
        """Convert a crop category string to its encoded integer."""
        category = category.strip().lower()
        if category in CROP_CATEGORY_MAP:
            return CROP_CATEGORY_MAP[category]
        # Fallback: 'other'
        return CROP_CATEGORY_MAP.get("other", 0)

    def _prepare_features(self, input_data: Dict[str, Any]) -> np.ndarray:
        """
        Transform raw API input into the feature vector expected by the model.
        
        Expected feature order (from preprocess.py):
            n, p, k, temperature, humidity, ph, rainfall, crop_category
        """
        category_encoded = self._encode_crop_category(
            input_data.get("crop_category", "other")
        )

        features = np.array([[
            float(input_data["N"]),
            float(input_data["P"]),
            float(input_data["K"]),
            float(input_data["temperature"]),
            float(input_data["humidity"]),
            float(input_data["ph"]),
            float(input_data["rainfall"]),
            category_encoded,
        ]])

        return features

    # ─── Prediction ──────────────────────────────────────────

    def predict_top_crops(
        self,
        input_data: Dict[str, Any],
        top_n: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Predict the top-N crops with confidence scores.
        
        Args:
            input_data: Dict with keys N, P, K, temperature, humidity,
                        ph, rainfall, crop_category.
            top_n: Number of top predictions to return.
        
        Returns:
            List of dicts: [{"crop": str, "confidence": float}, ...]
        """
        if not self._loaded:
            self.load()

        features = self._prepare_features(input_data)
        label_encoder = self.encoders["label"]

        # Get probability distribution over all classes
        probabilities = self.model.predict_proba(features)[0]

        # Sort by probability descending
        top_indices = np.argsort(probabilities)[::-1][:top_n]

        results = []
        for idx in top_indices:
            crop_name = label_encoder.inverse_transform([idx])[0]
            confidence = round(float(probabilities[idx]), 4)
            results.append({
                "crop": crop_name,
                "confidence": confidence,
            })

        logger.info(
            "Prediction: top-%d crops → %s",
            top_n,
            [(r["crop"], r["confidence"]) for r in results],
        )
        return results


# ─── Module-level singleton ──────────────────────────────────────────
predictor = CropPredictor()
