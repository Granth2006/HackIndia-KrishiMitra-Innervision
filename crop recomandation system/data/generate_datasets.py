"""
Dataset Generator for Crop Recommendation System
=================================================
Generates realistic synthetic datasets that mirror the structure and
statistical properties of the Kaggle datasets:

1. Crop Recommendation Dataset (by Atharva Ingle)
2. Crop Production in India Dataset (by Rajanand)

Run this script if you don't have the original Kaggle CSVs.
If you do, simply place them in this directory as:
  - crop_recommendation.csv
  - crop_production_india.csv

Usage:
    python data/generate_datasets.py
"""

import numpy as np
import pandas as pd
import os

# ─── Seed for reproducibility ────────────────────────────────────────
np.random.seed(42)

# ─── File paths ──────────────────────────────────────────────────────
DATA_DIR = os.path.dirname(os.path.abspath(__file__))
CROP_REC_PATH = os.path.join(DATA_DIR, "crop_recommendation.csv")
CROP_PROD_PATH = os.path.join(DATA_DIR, "crop_production_india.csv")

# ─── Crop growing-condition profiles ─────────────────────────────────
# Each entry: (N_mean, N_std, P_mean, P_std, K_mean, K_std,
#              temp_mean, temp_std, hum_mean, hum_std,
#              ph_mean, ph_std, rain_mean, rain_std)
CROP_PROFILES = {
    "rice":         (80, 10, 48, 8, 40, 6, 24, 3, 82, 5, 6.5, 0.5, 220, 30),
    "wheat":        (70, 10, 50, 10, 40, 8, 18, 3, 60, 8, 6.8, 0.4, 100, 20),
    "maize":        (78, 8, 50, 8, 35, 5, 22, 3, 65, 7, 6.2, 0.5, 90, 15),
    "barley":       (65, 8, 55, 10, 38, 6, 16, 3, 55, 8, 7.0, 0.4, 80, 15),
    "chickpea":     (40, 8, 68, 10, 80, 8, 18, 3, 17, 5, 7.0, 0.4, 75, 15),
    "lentil":       (20, 5, 68, 8, 20, 5, 20, 3, 50, 8, 6.8, 0.5, 50, 10),
    "pigeonpeas":   (20, 5, 65, 10, 20, 5, 28, 3, 50, 8, 6.0, 0.6, 130, 20),
    "mothbeans":    (25, 6, 55, 8, 22, 5, 30, 3, 48, 8, 6.5, 0.5, 50, 10),
    "mungbean":     (20, 5, 48, 8, 20, 4, 28, 3, 85, 5, 6.5, 0.4, 50, 10),
    "blackgram":    (40, 6, 60, 8, 20, 4, 30, 3, 65, 6, 7.0, 0.4, 70, 10),
    "kidneybeans":  (20, 5, 60, 8, 20, 4, 20, 3, 22, 5, 5.8, 0.5, 120, 15),
    "banana":       (100, 10, 75, 8, 50, 8, 27, 2, 80, 5, 6.0, 0.4, 100, 20),
    "mango":        (20, 5, 27, 5, 30, 5, 32, 3, 50, 8, 5.8, 0.5, 100, 15),
    "grapes":       (25, 5, 130, 10, 200, 15, 25, 4, 82, 5, 6.0, 0.5, 75, 10),
    "watermelon":   (100, 8, 20, 5, 50, 8, 26, 3, 90, 4, 6.5, 0.4, 50, 10),
    "muskmelon":    (100, 8, 18, 5, 50, 8, 28, 3, 92, 3, 6.4, 0.4, 25, 8),
    "apple":        (25, 5, 130, 10, 200, 15, 22, 3, 92, 3, 6.0, 0.5, 110, 15),
    "orange":       (20, 5, 15, 4, 10, 3, 25, 3, 92, 3, 7.0, 0.4, 110, 15),
    "papaya":       (50, 8, 60, 8, 50, 8, 34, 3, 92, 3, 6.8, 0.4, 150, 20),
    "coconut":      (22, 5, 10, 3, 30, 6, 27, 2, 95, 3, 6.0, 0.5, 180, 25),
    "cotton":       (120, 12, 45, 8, 20, 5, 24, 3, 80, 5, 7.0, 0.4, 80, 15),
    "jute":         (80, 10, 40, 8, 40, 6, 25, 2, 85, 4, 6.8, 0.4, 180, 20),
    "coffee":       (100, 10, 20, 5, 30, 5, 25, 2, 60, 8, 6.5, 0.5, 160, 20),
    "pomegranate":  (20, 5, 10, 3, 40, 6, 22, 3, 90, 3, 6.5, 0.5, 40, 10),
    "groundnut":    (40, 6, 60, 8, 20, 4, 28, 3, 55, 8, 6.5, 0.4, 65, 10),
    "sunflower":    (50, 8, 40, 8, 35, 6, 22, 3, 50, 8, 6.5, 0.5, 60, 10),
    "potato":       (60, 8, 55, 8, 50, 8, 20, 3, 70, 8, 6.0, 0.4, 80, 12),
    "tomato":       (55, 8, 50, 8, 48, 8, 25, 3, 65, 8, 6.5, 0.5, 70, 10),
    "onion":        (50, 8, 45, 8, 55, 8, 22, 3, 60, 8, 6.8, 0.4, 60, 10),
}

SAMPLES_PER_CROP = 100  # ~2900 total rows (close to original ~2200)

# ─── Indian states and their major crops ─────────────────────────────
STATE_CROPS = {
    "Andhra Pradesh":   ["rice", "cotton", "groundnut", "maize", "chickpea", "banana", "mango", "onion"],
    "Assam":            ["rice", "jute", "potato", "banana", "coconut", "maize"],
    "Bihar":            ["rice", "wheat", "maize", "lentil", "potato", "onion", "banana"],
    "Gujarat":          ["cotton", "groundnut", "wheat", "rice", "banana", "mango", "onion", "potato"],
    "Haryana":          ["wheat", "rice", "barley", "cotton", "chickpea", "sunflower", "potato"],
    "Himachal Pradesh": ["apple", "wheat", "maize", "barley", "potato"],
    "Karnataka":        ["rice", "coffee", "coconut", "maize", "groundnut", "cotton", "mango", "tomato"],
    "Kerala":           ["coconut", "rice", "banana", "coffee", "papaya"],
    "Madhya Pradesh":   ["wheat", "chickpea", "lentil", "cotton", "groundnut", "onion", "potato"],
    "Maharashtra":      ["cotton", "groundnut", "rice", "wheat", "onion", "pomegranate", "mango", "tomato"],
    "Odisha":           ["rice", "groundnut", "jute", "maize", "coconut"],
    "Punjab":           ["wheat", "rice", "cotton", "maize", "barley", "potato", "sunflower"],
    "Rajasthan":        ["wheat", "barley", "groundnut", "chickpea", "mungbean", "mothbeans"],
    "Tamil Nadu":       ["rice", "coconut", "groundnut", "cotton", "banana", "mango", "tomato"],
    "Telangana":        ["rice", "cotton", "maize", "chickpea", "groundnut", "mango"],
    "Uttar Pradesh":    ["wheat", "rice", "maize", "potato", "onion", "tomato", "lentil", "chickpea"],
    "West Bengal":      ["rice", "jute", "potato", "wheat", "banana", "coconut"],
}

DISTRICTS_PER_STATE = {
    "Andhra Pradesh": ["Anantapur", "Guntur", "East Godavari", "Krishna", "Kurnool"],
    "Assam": ["Kamrup", "Nagaon", "Sonitpur", "Dibrugarh"],
    "Bihar": ["Patna", "Muzaffarpur", "Bhagalpur", "Gaya", "Nalanda"],
    "Gujarat": ["Ahmedabad", "Rajkot", "Junagadh", "Surat", "Bharuch"],
    "Haryana": ["Karnal", "Hisar", "Ambala", "Sonipat", "Rohtak"],
    "Himachal Pradesh": ["Shimla", "Kullu", "Mandi", "Kangra"],
    "Karnataka": ["Bangalore", "Mysore", "Belgaum", "Hassan", "Raichur"],
    "Kerala": ["Ernakulam", "Thrissur", "Alappuzha", "Kozhikode"],
    "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Ujjain", "Sagar"],
    "Maharashtra": ["Pune", "Nashik", "Nagpur", "Aurangabad", "Kolhapur"],
    "Odisha": ["Cuttack", "Ganjam", "Balasore", "Puri"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Sangrur"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Udaipur", "Bikaner"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Thanjavur", "Salem"],
    "Telangana": ["Hyderabad", "Warangal", "Karimnagar", "Nalgonda"],
    "Uttar Pradesh": ["Lucknow", "Agra", "Varanasi", "Meerut", "Kanpur"],
    "West Bengal": ["Kolkata", "Hooghly", "Burdwan", "Nadia", "Murshidabad"],
}


def generate_crop_recommendation_dataset() -> pd.DataFrame:
    """
    Generate a synthetic Crop Recommendation dataset matching
    the Kaggle schema: N, P, K, temperature, humidity, ph, rainfall, label.
    """
    rows = []
    for crop, profile in CROP_PROFILES.items():
        (n_m, n_s, p_m, p_s, k_m, k_s,
         t_m, t_s, h_m, h_s, ph_m, ph_s, r_m, r_s) = profile

        for _ in range(SAMPLES_PER_CROP):
            rows.append({
                "N":           max(0, int(np.random.normal(n_m, n_s))),
                "P":           max(0, int(np.random.normal(p_m, p_s))),
                "K":           max(0, int(np.random.normal(k_m, k_s))),
                "temperature": round(np.clip(np.random.normal(t_m, t_s), 5, 50), 2),
                "humidity":    round(np.clip(np.random.normal(h_m, h_s), 10, 100), 2),
                "ph":          round(np.clip(np.random.normal(ph_m, ph_s), 3.5, 9.5), 2),
                "rainfall":    round(max(10, np.random.normal(r_m, r_s)), 2),
                "label":       crop,
            })

    df = pd.DataFrame(rows)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    return df


def generate_crop_production_dataset() -> pd.DataFrame:
    """
    Generate a synthetic Crop Production in India dataset matching
    the Kaggle schema: State_Name, District_Name, Crop, Year, Area, Production.
    """
    rows = []
    years = list(range(2010, 2024))

    for state, crops in STATE_CROPS.items():
        districts = DISTRICTS_PER_STATE.get(state, ["Unknown"])
        for crop in crops:
            for year in years:
                district = np.random.choice(districts)
                area = round(np.random.uniform(500, 50000), 2)
                # Yield varies by crop type
                yield_per_ha = np.random.uniform(0.8, 4.5)
                production = round(area * yield_per_ha, 2)
                rows.append({
                    "State_Name":    state,
                    "District_Name": district,
                    "Crop":          crop.capitalize(),
                    "Year":          year,
                    "Area":          area,
                    "Production":    production,
                })

    df = pd.DataFrame(rows)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    return df


def main():
    print("=" * 60)
    print("  Crop Recommendation System — Dataset Generator")
    print("=" * 60)

    # ── Dataset 1: Crop Recommendation ───────────────────────
    print("\n[1/2] Generating Crop Recommendation dataset ...")
    df_rec = generate_crop_recommendation_dataset()
    df_rec.to_csv(CROP_REC_PATH, index=False)
    print(f"      ✔ Saved {len(df_rec)} rows → {CROP_REC_PATH}")
    print(f"      Crops: {df_rec['label'].nunique()} unique labels")
    print(f"      Columns: {list(df_rec.columns)}")

    # ── Dataset 2: Crop Production ───────────────────────────
    print("\n[2/2] Generating Crop Production in India dataset ...")
    df_prod = generate_crop_production_dataset()
    df_prod.to_csv(CROP_PROD_PATH, index=False)
    print(f"      ✔ Saved {len(df_prod)} rows → {CROP_PROD_PATH}")
    print(f"      States: {df_prod['State_Name'].nunique()}")
    print(f"      Crops: {df_prod['Crop'].nunique()}")
    print(f"      Columns: {list(df_prod.columns)}")

    print("\n" + "=" * 60)
    print("  Datasets generated successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
