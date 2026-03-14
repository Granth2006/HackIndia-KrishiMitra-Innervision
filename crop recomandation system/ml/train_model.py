"""
Model Training Script
======================
Trains multiple ML classifiers on the preprocessed crop dataset,
evaluates them, selects the best, and persists the model + encoders.

Models trained:
  • RandomForestClassifier
  • XGBoostClassifier
  • DecisionTreeClassifier

Usage:
    python ml/train_model.py
"""

import os
import sys
import logging
import time
from typing import Dict, Any

import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, classification_report
from xgboost import XGBClassifier

# ─── Ensure project root is on the path ──────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.preprocess import run_preprocessing_pipeline, FEATURE_COLUMNS

# ─── Logger ──────────────────────────────────────────────────────────
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")

# ─── Paths ───────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

MODEL_PATH   = os.path.join(MODEL_DIR, "crop_model.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "encoder.pkl")
META_PATH    = os.path.join(MODEL_DIR, "model_meta.pkl")


# ═════════════════════════════════════════════════════════════════════
#  Model Definitions
# ═════════════════════════════════════════════════════════════════════

def get_models() -> Dict[str, Any]:
    """Return a dict of model_name → model_instance."""
    return {
        "RandomForest": RandomForestClassifier(
            n_estimators=200,
            max_depth=20,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        ),
        "XGBoost": XGBClassifier(
            n_estimators=200,
            max_depth=10,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            use_label_encoder=False,
            eval_metric="mlogloss",
        ),
        "DecisionTree": DecisionTreeClassifier(
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
        ),
    }


# ═════════════════════════════════════════════════════════════════════
#  Training Loop
# ═════════════════════════════════════════════════════════════════════

def train_and_evaluate() -> None:
    """Train all models, compare, save the best one."""

    # ── Preprocessing ────────────────────────────────────────
    X_train, X_test, y_train, y_test, encoders, feature_names = (
        run_preprocessing_pipeline()
    )

    models = get_models()
    results: Dict[str, Dict[str, Any]] = {}

    print("\n" + "═" * 60)
    print("  MODEL TRAINING & EVALUATION")
    print("═" * 60)

    for name, model in models.items():
        print(f"\n{'─' * 50}")
        print(f"  Training: {name}")
        print(f"{'─' * 50}")

        start = time.time()
        model.fit(X_train, y_train)
        train_time = time.time() - start

        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)

        # Decode labels for the classification report
        label_encoder = encoders["label"]
        target_names = label_encoder.classes_

        report = classification_report(
            y_test, y_pred, target_names=target_names, zero_division=0
        )

        results[name] = {
            "model": model,
            "accuracy": accuracy,
            "train_time": train_time,
            "report": report,
        }

        print(f"  Accuracy : {accuracy:.4f}")
        print(f"  Time     : {train_time:.2f}s")
        print(f"\n  Classification Report:\n{report}")

    # ── Select Best Model ────────────────────────────────────
    best_name = max(results, key=lambda k: results[k]["accuracy"])
    best = results[best_name]

    print("\n" + "═" * 60)
    print(f"  🏆 BEST MODEL: {best_name}")
    print(f"     Accuracy : {best['accuracy']:.4f}")
    print(f"     Time     : {best['train_time']:.2f}s")
    print("═" * 60)

    # ── Persist ──────────────────────────────────────────────
    joblib.dump(best["model"], MODEL_PATH)
    logger.info("  ✔ Model saved → %s", MODEL_PATH)

    joblib.dump(encoders, ENCODER_PATH)
    logger.info("  ✔ Encoders saved → %s", ENCODER_PATH)

    # Save metadata (features used, model name, accuracy)
    meta = {
        "model_name": best_name,
        "accuracy": best["accuracy"],
        "feature_names": feature_names,
        "n_classes": len(encoders["label"].classes_),
        "classes": list(encoders["label"].classes_),
    }
    joblib.dump(meta, META_PATH)
    logger.info("  ✔ Metadata saved → %s", META_PATH)

    # ── Comparison Summary ───────────────────────────────────
    print("\n" + "═" * 60)
    print("  MODEL COMPARISON SUMMARY")
    print("═" * 60)
    print(f"  {'Model':<20} {'Accuracy':>10} {'Time (s)':>10}")
    print(f"  {'─' * 42}")
    for name, res in sorted(results.items(), key=lambda x: -x[1]["accuracy"]):
        marker = " ★" if name == best_name else ""
        print(f"  {name:<20} {res['accuracy']:>10.4f} {res['train_time']:>10.2f}{marker}")
    print("═" * 60)


# ═════════════════════════════════════════════════════════════════════
#  Entry Point
# ═════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    train_and_evaluate()
