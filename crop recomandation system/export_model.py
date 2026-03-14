"""
Export ML Model Predictions to JSON
====================================
Pre-computes crop predictions for all Indian state × crop_category combinations
at multiple temperature/humidity/rainfall points, then exports as a JSON file
that can be used by the Vercel serverless function.

Usage:
    python export_model.py
"""

import os
import sys
import json
import itertools
import numpy as np
import joblib

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.prediction_service import CropPredictor

# ─── Paths ───────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")
OUTPUT_PATH = os.path.join(BASE_DIR, "..", "api", "ml-crop-data.json")

# ─── Regional Soil Data (matching the website's data) ────────────────
INDIAN_SOIL_DATA = {
    "andhra pradesh":    {"N": 85,  "P": 38, "K": 280, "ph": 7.2},
    "assam":             {"N": 95,  "P": 22, "K": 180, "ph": 5.5},
    "bihar":             {"N": 78,  "P": 32, "K": 220, "ph": 7.0},
    "chhattisgarh":      {"N": 72,  "P": 18, "K": 200, "ph": 6.2},
    "gujarat":           {"N": 68,  "P": 35, "K": 320, "ph": 7.8},
    "haryana":           {"N": 75,  "P": 42, "K": 260, "ph": 7.5},
    "himachal pradesh":  {"N": 90,  "P": 28, "K": 240, "ph": 6.0},
    "jharkhand":         {"N": 70,  "P": 20, "K": 190, "ph": 5.8},
    "karnataka":         {"N": 80,  "P": 35, "K": 300, "ph": 6.5},
    "kerala":            {"N": 105, "P": 45, "K": 180, "ph": 5.2},
    "madhya pradesh":    {"N": 65,  "P": 30, "K": 280, "ph": 7.2},
    "maharashtra":       {"N": 70,  "P": 32, "K": 310, "ph": 7.5},
    "odisha":            {"N": 82,  "P": 25, "K": 200, "ph": 5.8},
    "punjab":            {"N": 80,  "P": 48, "K": 240, "ph": 7.8},
    "rajasthan":         {"N": 55,  "P": 22, "K": 350, "ph": 8.2},
    "tamil nadu":        {"N": 88,  "P": 40, "K": 290, "ph": 7.0},
    "telangana":         {"N": 78,  "P": 36, "K": 275, "ph": 7.3},
    "uttar pradesh":     {"N": 72,  "P": 38, "K": 230, "ph": 7.5},
    "uttarakhand":       {"N": 85,  "P": 30, "K": 220, "ph": 6.5},
    "west bengal":       {"N": 92,  "P": 28, "K": 195, "ph": 5.8},
    "delhi":             {"N": 70,  "P": 30, "K": 190, "ph": 7.6},
    "jammu and kashmir": {"N": 90,  "P": 25, "K": 160, "ph": 7.0},
    "chandigarh":        {"N": 75,  "P": 35, "K": 220, "ph": 7.5},
}

DEFAULT_SOIL = {"N": 75, "P": 35, "K": 250, "ph": 6.8}

# Crop categories matching the ML model
CROP_CATEGORIES = ["grains", "pulses", "fruits", "commercial", "oilseeds", "vegetables", "other"]

# Weather ranges (temperature bands)
TEMP_BANDS = [
    {"label": "cold",      "temp": 15, "humidity": 50, "rainfall": 60},
    {"label": "mild",      "temp": 22, "humidity": 60, "rainfall": 100},
    {"label": "warm",      "temp": 28, "humidity": 70, "rainfall": 150},
    {"label": "hot",       "temp": 35, "humidity": 65, "rainfall": 80},
    {"label": "hot_humid", "temp": 32, "humidity": 85, "rainfall": 200},
    {"label": "cool_dry",  "temp": 18, "humidity": 40, "rainfall": 40},
]

# Crop knowledge base for additional details
CROP_DETAILS = {
    "rice":        {"yield": "3-6 tons/acre", "water": "1200-2000 mm/season", "price": "₹18-25/kg", "season": "Kharif (June-Nov)"},
    "wheat":       {"yield": "2-4 tons/acre", "water": "450-650 mm/season", "price": "₹20-28/kg", "season": "Rabi (Nov-Apr)"},
    "maize":       {"yield": "3-5 tons/acre", "water": "500-800 mm/season", "price": "₹15-22/kg", "season": "Kharif/Rabi"},
    "barley":      {"yield": "2-3 tons/acre", "water": "300-500 mm/season", "price": "₹18-25/kg", "season": "Rabi (Oct-Mar)"},
    "chickpea":    {"yield": "1-2 tons/acre", "water": "300-400 mm/season", "price": "₹50-70/kg", "season": "Rabi (Oct-Mar)"},
    "lentil":      {"yield": "0.8-1.5 tons/acre", "water": "250-350 mm/season", "price": "₹55-80/kg", "season": "Rabi (Oct-Mar)"},
    "pigeonpeas":  {"yield": "0.8-1.5 tons/acre", "water": "350-500 mm/season", "price": "₹60-85/kg", "season": "Kharif (June-Dec)"},
    "mothbeans":   {"yield": "0.5-1 tons/acre", "water": "200-350 mm/season", "price": "₹60-90/kg", "season": "Kharif (July-Oct)"},
    "mungbean":    {"yield": "0.5-1 tons/acre", "water": "300-400 mm/season", "price": "₹65-90/kg", "season": "Kharif/Summer"},
    "blackgram":   {"yield": "0.5-1.2 tons/acre", "water": "300-400 mm/season", "price": "₹55-80/kg", "season": "Kharif (July-Oct)"},
    "kidneybeans": {"yield": "1-2 tons/acre", "water": "350-500 mm/season", "price": "₹70-120/kg", "season": "Kharif/Rabi"},
    "banana":      {"yield": "15-30 tons/acre", "water": "1200-2200 mm/season", "price": "₹15-30/kg", "season": "Year-round"},
    "mango":       {"yield": "4-8 tons/acre", "water": "800-1600 mm/season", "price": "₹30-80/kg", "season": "Summer (Mar-Jun)"},
    "grapes":      {"yield": "8-15 tons/acre", "water": "500-800 mm/season", "price": "₹40-80/kg", "season": "Winter-Spring"},
    "watermelon":  {"yield": "10-20 tons/acre", "water": "400-600 mm/season", "price": "₹8-15/kg", "season": "Summer (Feb-Jun)"},
    "muskmelon":   {"yield": "8-15 tons/acre", "water": "400-600 mm/season", "price": "₹15-30/kg", "season": "Summer (Feb-Jun)"},
    "apple":       {"yield": "5-10 tons/acre", "water": "600-1000 mm/season", "price": "₹60-150/kg", "season": "Summer (Jul-Oct)"},
    "orange":      {"yield": "6-12 tons/acre", "water": "600-1200 mm/season", "price": "₹25-50/kg", "season": "Winter (Nov-Mar)"},
    "papaya":      {"yield": "20-40 tons/acre", "water": "1000-1500 mm/season", "price": "₹15-30/kg", "season": "Year-round"},
    "coconut":     {"yield": "3-5 tons copra/acre", "water": "1300-2500 mm/season", "price": "₹25-40/kg copra", "season": "Year-round"},
    "pomegranate": {"yield": "5-10 tons/acre", "water": "500-800 mm/season", "price": "₹50-120/kg", "season": "Feb-Mar harvest"},
    "cotton":      {"yield": "1-2 tons/acre", "water": "700-1300 mm/season", "price": "₹55-70/kg", "season": "Kharif (Apr-Dec)"},
    "coffee":      {"yield": "0.5-1.5 tons/acre", "water": "1500-2500 mm/season", "price": "₹200-400/kg", "season": "Year-round"},
    "jute":        {"yield": "2-3 tons/acre", "water": "1000-1500 mm/season", "price": "₹40-55/kg", "season": "Kharif (Mar-Aug)"},
    "groundnut":   {"yield": "1-2 tons/acre", "water": "500-700 mm/season", "price": "₹45-65/kg", "season": "Kharif/Rabi"},
    "sunflower":   {"yield": "0.8-1.5 tons/acre", "water": "400-500 mm/season", "price": "₹45-60/kg", "season": "Rabi/Spring"},
    "potato":      {"yield": "10-20 tons/acre", "water": "500-700 mm/season", "price": "₹10-25/kg", "season": "Rabi (Oct-Mar)"},
    "tomato":      {"yield": "10-25 tons/acre", "water": "400-600 mm/season", "price": "₹15-40/kg", "season": "Year-round"},
    "onion":       {"yield": "8-15 tons/acre", "water": "350-550 mm/season", "price": "₹15-35/kg", "season": "Rabi (Nov-May)"},
}


def get_temp_band(temperature):
    """Find the closest temperature band for a given temperature."""
    closest = min(TEMP_BANDS, key=lambda b: abs(b["temp"] - temperature))
    return closest["label"]


def main():
    print("=" * 60)
    print("  Exporting ML Model Predictions to JSON")
    print("=" * 60)

    # Load the predictor
    predictor = CropPredictor()
    predictor.load()

    print(f"\nModel: {predictor.meta['model_name']}")
    print(f"Accuracy: {predictor.meta['accuracy']:.4f}")
    print(f"Classes: {predictor.meta['classes']}")
    print(f"Num classes: {predictor.meta['n_classes']}")

    # Pre-compute predictions for all combinations
    predictions = {}
    total = 0

    for state, soil in INDIAN_SOIL_DATA.items():
        predictions[state] = {}
        for category in CROP_CATEGORIES:
            predictions[state][category] = {}
            for band in TEMP_BANDS:
                input_data = {
                    "N": soil["N"],
                    "P": soil["P"],
                    "K": soil["K"],
                    "temperature": band["temp"],
                    "humidity": band["humidity"],
                    "ph": soil["ph"],
                    "rainfall": band["rainfall"],
                    "crop_category": category,
                }

                top_crops = predictor.predict_top_crops(input_data, top_n=4)

                # Enrich with details
                enriched = []
                for crop_rec in top_crops:
                    crop_name = crop_rec["crop"]
                    details = CROP_DETAILS.get(crop_name, {})
                    enriched.append({
                        "name": crop_name.title(),
                        "confidence": crop_rec["confidence"],
                        "suitability": max(50, int(crop_rec["confidence"] * 100)),
                        "expectedYield": details.get("yield", "2-5 tons/acre"),
                        "waterRequirement": details.get("water", "400-800 mm/season"),
                        "profitMargin": details.get("price", "₹20-40/kg"),
                        "season": details.get("season", "Suitable for current conditions"),
                    })

                predictions[state][category][band["label"]] = enriched
                total += 1

    print(f"\nGenerated {total} prediction entries")

    # Build the output JSON
    output = {
        "model_info": {
            "model_name": predictor.meta["model_name"],
            "accuracy": predictor.meta["accuracy"],
            "n_classes": predictor.meta["n_classes"],
            "classes": predictor.meta["classes"],
        },
        "soil_data": INDIAN_SOIL_DATA,
        "crop_details": CROP_DETAILS,
        "predictions": predictions,
    }

    # Write to file
    os.makedirs(os.path.dirname(os.path.abspath(OUTPUT_PATH)), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    file_size = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\n✔ Exported to: {os.path.abspath(OUTPUT_PATH)}")
    print(f"  File size: {file_size:.1f} KB")
    print("=" * 60)


if __name__ == "__main__":
    main()
