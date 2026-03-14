"""
Data Preprocessing Pipeline
============================
Handles all data loading, cleaning, feature engineering, and encoding
for the Crop Recommendation ML model.

Key responsibilities:
  • Load and merge the two datasets
  • Clean missing values and duplicates
  • Standardise column names and normalise crop labels
  • Derive a `crop_category` column
  • Encode categorical features
  • Provide train/test splits ready for model training
"""

import os
import logging
from typing import Tuple, Dict, List

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

# ─── Logger ──────────────────────────────────────────────────────────
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")

# ─── Paths ───────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

CROP_REC_PATH  = os.path.join(DATA_DIR, "crop_recommendation.csv")
CROP_PROD_PATH = os.path.join(DATA_DIR, "crop_production_india.csv")

# ─── Crop → Category mapping ────────────────────────────────────────
CROP_CATEGORY_MAP: Dict[str, str] = {
    # Grains / Cereals
    "rice":        "grains",
    "wheat":       "grains",
    "maize":       "grains",
    "barley":      "grains",
    # Pulses
    "chickpea":    "pulses",
    "lentil":      "pulses",
    "pigeonpeas":  "pulses",
    "mothbeans":   "pulses",
    "mungbean":    "pulses",
    "blackgram":   "pulses",
    "kidneybeans": "pulses",
    # Fruits
    "banana":      "fruits",
    "mango":       "fruits",
    "grapes":      "fruits",
    "watermelon":  "fruits",
    "muskmelon":   "fruits",
    "apple":       "fruits",
    "orange":      "fruits",
    "papaya":      "fruits",
    "coconut":     "fruits",
    "pomegranate": "fruits",
    # Commercial crops
    "cotton":      "commercial",
    "coffee":      "commercial",
    "jute":        "commercial",
    # Oilseeds
    "groundnut":   "oilseeds",
    "sunflower":   "oilseeds",
    # Vegetables
    "potato":      "vegetables",
    "tomato":      "vegetables",
    "onion":       "vegetables",
}

# ─── Indian states for location encoding ────────────────────────────
INDIAN_STATES: List[str] = [
    "Andhra Pradesh", "Assam", "Bihar", "Gujarat", "Haryana",
    "Himachal Pradesh", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu",
    "Telangana", "Uttar Pradesh", "West Bengal",
]


# ═════════════════════════════════════════════════════════════════════
#  Loading
# ═════════════════════════════════════════════════════════════════════

def load_crop_recommendation() -> pd.DataFrame:
    """Load the primary crop recommendation CSV."""
    logger.info("Loading crop recommendation dataset from %s", CROP_REC_PATH)
    df = pd.read_csv(CROP_REC_PATH)
    # Standardise column names
    df.columns = [c.strip().lower() for c in df.columns]
    logger.info("  → shape: %s", df.shape)
    return df


def load_crop_production() -> pd.DataFrame:
    """Load the crop production in India CSV."""
    logger.info("Loading crop production dataset from %s", CROP_PROD_PATH)
    df = pd.read_csv(CROP_PROD_PATH)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    logger.info("  → shape: %s", df.shape)
    return df


# ═════════════════════════════════════════════════════════════════════
#  Cleaning
# ═════════════════════════════════════════════════════════════════════

def clean_dataframe(df: pd.DataFrame, name: str = "dataset") -> pd.DataFrame:
    """
    Generic cleaning:
      1. Drop fully-duplicate rows
      2. Drop rows where ALL values are NaN
      3. Fill remaining numeric NaN with column median
      4. Fill remaining string NaN with 'unknown'
    """
    before = len(df)
    df = df.drop_duplicates()
    df = df.dropna(how="all")

    # Numeric columns → fill with median
    num_cols = df.select_dtypes(include=[np.number]).columns
    for col in num_cols:
        if df[col].isna().sum() > 0:
            df[col] = df[col].fillna(df[col].median())

    # Categorical columns → fill with 'unknown'
    cat_cols = df.select_dtypes(include=["object"]).columns
    for col in cat_cols:
        if df[col].isna().sum() > 0:
            df[col] = df[col].fillna("unknown")

    after = len(df)
    logger.info("  Cleaned %s: %d → %d rows", name, before, after)
    return df


def normalise_crop_names(df: pd.DataFrame, col: str = "label") -> pd.DataFrame:
    """Lowercase and strip crop names for consistency."""
    df[col] = df[col].str.strip().str.lower()
    return df


# ═════════════════════════════════════════════════════════════════════
#  Feature Engineering
# ═════════════════════════════════════════════════════════════════════

def add_crop_category(df: pd.DataFrame, crop_col: str = "label") -> pd.DataFrame:
    """Map each crop to its broad category (grains, pulses, etc.)."""
    df["crop_category"] = df[crop_col].map(CROP_CATEGORY_MAP).fillna("other")
    logger.info("  Added crop_category — distribution:\n%s",
                df["crop_category"].value_counts().to_string())
    return df


def create_location_features(df_rec: pd.DataFrame, df_prod: pd.DataFrame) -> pd.DataFrame:
    """
    Enrich the recommendation dataset with location-level production
    statistics (mean area, mean production) from the production dataset.
    
    This creates a mapping of crop → average production metrics that
    can be used as supplementary features.
    """
    if df_prod is None or df_prod.empty:
        logger.warning("  Production dataset unavailable; skipping location features.")
        return df_rec

    # Normalise crop names in production data
    df_prod["crop"] = df_prod["crop"].str.strip().str.lower()

    # Aggregate at crop level
    crop_stats = (
        df_prod.groupby("crop")
        .agg(
            avg_area=("area", "mean"),
            avg_production=("production", "mean"),
            total_production=("production", "sum"),
        )
        .reset_index()
    )

    # Merge on crop name
    df_rec = df_rec.merge(
        crop_stats, left_on="label", right_on="crop", how="left"
    )
    # Drop the duplicate 'crop' column from production data
    if "crop" in df_rec.columns:
        df_rec = df_rec.drop(columns=["crop"])

    # Fill NaN (crops not present in production data) with 0
    for c in ["avg_area", "avg_production", "total_production"]:
        if c in df_rec.columns:
            df_rec[c] = df_rec[c].fillna(0)

    logger.info("  Merged production statistics for %d crops", len(crop_stats))
    return df_rec


# ═════════════════════════════════════════════════════════════════════
#  Encoding
# ═════════════════════════════════════════════════════════════════════

def encode_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, LabelEncoder]]:
    """
    Encode categorical columns using LabelEncoder.
    Returns the transformed DataFrame and a dict of fitted encoders.
    """
    encoders: Dict[str, LabelEncoder] = {}
    categorical_cols = ["crop_category"]

    for col in categorical_cols:
        if col in df.columns:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            encoders[col] = le
            logger.info("  Encoded %s — %d classes", col, len(le.classes_))

    # Encode target variable (label)
    le_label = LabelEncoder()
    df["label_encoded"] = le_label.fit_transform(df["label"])
    encoders["label"] = le_label
    logger.info("  Encoded label — %d classes", len(le_label.classes_))

    return df, encoders


# ═════════════════════════════════════════════════════════════════════
#  Full Pipeline
# ═════════════════════════════════════════════════════════════════════

FEATURE_COLUMNS = [
    "n", "p", "k", "temperature", "humidity", "ph", "rainfall", "crop_category"
]


def run_preprocessing_pipeline(
    test_size: float = 0.2,
    random_state: int = 42,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, Dict[str, LabelEncoder], List[str]]:
    """
    End-to-end preprocessing:
      1. Load datasets
      2. Clean & normalise
      3. Engineer features
      4. Encode
      5. Split

    Returns:
        X_train, X_test, y_train, y_test, encoders, feature_names
    """
    logger.info("=" * 60)
    logger.info("  Starting Preprocessing Pipeline")
    logger.info("=" * 60)

    # ── Step 1: Load ─────────────────────────────────────────
    df_rec = load_crop_recommendation()

    df_prod = None
    if os.path.exists(CROP_PROD_PATH):
        df_prod = load_crop_production()
        df_prod = clean_dataframe(df_prod, "crop_production")

    # ── Step 2: Clean ────────────────────────────────────────
    df_rec = clean_dataframe(df_rec, "crop_recommendation")
    df_rec = normalise_crop_names(df_rec, "label")

    # ── Step 3: Feature Engineering ──────────────────────────
    df_rec = add_crop_category(df_rec, "label")
    df_rec = create_location_features(df_rec, df_prod)

    # ── Step 4: Encode ───────────────────────────────────────
    df_rec, encoders = encode_features(df_rec)

    # ── Step 5: Split ────────────────────────────────────────
    feature_cols = [c for c in FEATURE_COLUMNS if c in df_rec.columns]
    X = df_rec[feature_cols].values
    y = df_rec["label_encoded"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )

    logger.info("  Train set: %s | Test set: %s", X_train.shape, X_test.shape)
    logger.info("=" * 60)
    logger.info("  Preprocessing complete!")
    logger.info("=" * 60)

    return X_train, X_test, y_train, y_test, encoders, feature_cols
