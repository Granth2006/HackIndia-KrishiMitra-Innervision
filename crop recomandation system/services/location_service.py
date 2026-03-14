"""
Location, Weather & Soil Service
==================================
Automatically fetches environmental data so farmers don't have
to manually enter soil nutrients or weather conditions.

Data sources (all FREE, no API key required):
  • Open-Meteo Geocoding — city/state → latitude, longitude
  • Open-Meteo Weather   — lat/lon → temperature, humidity, rainfall
  • SoilGrids (ISRIC)    — lat/lon → nitrogen, pH (satellite-derived)
  • Regional soil DB     — state → typical P, K values for India

Farm size unit conversions:
  • 1 acre  = 1 acre
  • 1 bigha = 0.625 acres (standard North India bigha)
  • 1 yard² = 0.000207 acres (1 sq yard)
"""

import logging
from typing import Dict, Any, Optional, Tuple

import httpx

# ─── Logger ──────────────────────────────────────────────────────────
logger = logging.getLogger(__name__)

# ─── API Endpoints (all free, no key required) ───────────────────────
GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"

# ─── HTTP Client Config ─────────────────────────────────────────────
TIMEOUT = 15.0  # seconds

# ─── Farm Size Conversions (to acres) ────────────────────────────────
UNIT_TO_ACRES = {
    "acre":  1.0,
    "bigha": 0.625,       # Standard North India bigha
    "yard":  0.000207,    # 1 square yard
}

# ─── Regional Soil Data (Indian state-level averages) ────────────────
# Source: Indian Council of Agricultural Research (ICAR) soil surveys
# Values: { state: { P_avg, K_avg, N_avg_fallback, pH_avg_fallback } }
INDIAN_SOIL_DATA: Dict[str, Dict[str, float]] = {
    "Andhra Pradesh":    {"P": 38, "K": 280, "N": 85,  "pH": 7.2},
    "Assam":             {"P": 22, "K": 180, "N": 95,  "pH": 5.5},
    "Bihar":             {"P": 32, "K": 220, "N": 78,  "pH": 7.0},
    "Chhattisgarh":      {"P": 18, "K": 200, "N": 72,  "pH": 6.2},
    "Gujarat":           {"P": 35, "K": 320, "N": 68,  "pH": 7.8},
    "Haryana":           {"P": 42, "K": 260, "N": 75,  "pH": 7.5},
    "Himachal Pradesh":  {"P": 28, "K": 240, "N": 90,  "pH": 6.0},
    "Jharkhand":         {"P": 20, "K": 190, "N": 70,  "pH": 5.8},
    "Karnataka":         {"P": 35, "K": 300, "N": 80,  "pH": 6.5},
    "Kerala":            {"P": 45, "K": 180, "N": 105, "pH": 5.2},
    "Madhya Pradesh":    {"P": 30, "K": 280, "N": 65,  "pH": 7.2},
    "Maharashtra":       {"P": 32, "K": 310, "N": 70,  "pH": 7.5},
    "Odisha":            {"P": 25, "K": 200, "N": 82,  "pH": 5.8},
    "Punjab":            {"P": 48, "K": 240, "N": 80,  "pH": 7.8},
    "Rajasthan":         {"P": 22, "K": 350, "N": 55,  "pH": 8.2},
    "Tamil Nadu":        {"P": 40, "K": 290, "N": 88,  "pH": 7.0},
    "Telangana":         {"P": 36, "K": 275, "N": 78,  "pH": 7.3},
    "Uttar Pradesh":     {"P": 38, "K": 230, "N": 72,  "pH": 7.5},
    "Uttarakhand":       {"P": 30, "K": 220, "N": 85,  "pH": 6.5},
    "West Bengal":       {"P": 28, "K": 195, "N": 92,  "pH": 5.8},
}

# Default for unlisted states
DEFAULT_SOIL = {"P": 35, "K": 250, "N": 75, "pH": 6.8}


# ═════════════════════════════════════════════════════════════════════
#  Geocoding — City/State → Coordinates
# ═════════════════════════════════════════════════════════════════════

async def geocode(city: str, state: str) -> Optional[Tuple[float, float]]:
    """
    Convert city + state to latitude/longitude using Open-Meteo Geocoding.
    
    Strategy: search by city name, filter results for India (country_code=IN).
    Falls back to state name if city search returns no results.
    
    Returns:
        (latitude, longitude) or None if not found.
    """
    # Try city first, then state as fallback
    search_terms = [city, f"{city} {state}", state]

    for term in search_terms:
        params = {
            "name": term.strip(),
            "count": 5,
            "language": "en",
            "format": "json",
        }

        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(GEOCODING_URL, params=params)
                resp.raise_for_status()
                data = resp.json()

            results = data.get("results", [])
            if not results:
                continue

            # Prefer Indian results
            india_results = [
                r for r in results
                if r.get("country_code", "").upper() == "IN"
            ]
            match = india_results[0] if india_results else results[0]

            lat = match["latitude"]
            lon = match["longitude"]
            name = match.get("name", city)
            logger.info("Geocoded '%s' → (%.4f, %.4f) [%s]", term, lat, lon, name)
            return (lat, lon)

        except Exception as e:
            logger.error("Geocoding error for '%s': %s", term, e)
            continue

    logger.warning("Geocoding: no results for city='%s', state='%s'", city, state)
    return None


# ═════════════════════════════════════════════════════════════════════
#  Weather — Coordinates → Temperature, Humidity, Rainfall
# ═════════════════════════════════════════════════════════════════════

async def get_weather(lat: float, lon: float) -> Dict[str, float]:
    """
    Fetch current weather data from Open-Meteo.
    
    Returns:
        Dict with keys: temperature, humidity, rainfall
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,rain",
        "daily": "precipitation_sum",
        "timezone": "Asia/Kolkata",
        "forecast_days": 30,
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(WEATHER_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        current = data.get("current", {})
        daily = data.get("daily", {})

        temperature = current.get("temperature_2m", 25.0)
        humidity = current.get("relative_humidity_2m", 60.0)

        # Sum rainfall over the forecast period for monthly estimate
        precip_list = daily.get("precipitation_sum", [])
        rainfall = sum(precip_list) if precip_list else 100.0

        result = {
            "temperature": round(temperature, 1),
            "humidity": round(humidity, 1),
            "rainfall": round(rainfall, 1),
        }
        logger.info("Weather at (%.2f, %.2f): %s", lat, lon, result)
        return result

    except Exception as e:
        logger.error("Weather API error: %s", e)
        return {"temperature": 25.0, "humidity": 60.0, "rainfall": 100.0}


# ═════════════════════════════════════════════════════════════════════
#  Soil — Coordinates → N, P, K, pH
# ═════════════════════════════════════════════════════════════════════

async def get_soil_data(
    lat: float, lon: float, state: str
) -> Dict[str, float]:
    """
    Fetch soil properties from SoilGrids (ISRIC) satellite data
    and supplement with regional averages for P and K.
    
    SoilGrids provides:
      - nitrogen (total N in cg/kg)
      - phh2o (soil pH × 10)
    
    P and K come from the regional Indian soil database.
    
    Returns:
        Dict with keys: N, P, K, ph
    """
    regional = INDIAN_SOIL_DATA.get(state, DEFAULT_SOIL)

    # Try SoilGrids for nitrogen and pH
    params = {
        "lon": lon,
        "lat": lat,
        "property": ["nitrogen", "phh2o"],
        "depth": "0-30cm",
        "value": "mean",
    }

    soil_n = regional["N"]
    soil_ph = regional["pH"]

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(SOILGRIDS_URL, params=params)

            if resp.status_code == 200:
                data = resp.json()
                properties = data.get("properties", {})
                layers = properties.get("layers", [])

                for layer in layers:
                    name = layer.get("name", "")
                    depths = layer.get("depths", [])
                    if depths:
                        values = depths[0].get("values", {})
                        mean_val = values.get("mean")

                        if mean_val is not None:
                            if name == "nitrogen":
                                # SoilGrids: cg/kg → approx kg/ha
                                # Rough conversion: cg/kg × 0.1 × 30 (depth) × 1.3 (density)
                                soil_n = round(mean_val * 0.1 * 30 * 1.3 / 100, 0)
                                soil_n = max(10, min(200, soil_n))  # clamp
                            elif name == "phh2o":
                                # SoilGrids: pH × 10 → pH
                                soil_ph = round(mean_val / 10.0, 1)
                                soil_ph = max(3.5, min(9.5, soil_ph))

                logger.info(
                    "SoilGrids at (%.2f, %.2f): N=%.0f, pH=%.1f",
                    lat, lon, soil_n, soil_ph,
                )
            else:
                logger.warning(
                    "SoilGrids returned %d; using regional averages for %s",
                    resp.status_code, state,
                )

    except Exception as e:
        logger.warning("SoilGrids API error: %s — using regional averages", e)

    result = {
        "N": soil_n,
        "P": regional["P"],
        "K": regional["K"],
        "ph": soil_ph,
    }
    logger.info("Soil data for %s: %s", state, result)
    return result


# ═════════════════════════════════════════════════════════════════════
#  Farm Size Conversion
# ═════════════════════════════════════════════════════════════════════

def convert_to_acres(size: float, unit: str) -> float:
    """Convert farm size to acres."""
    unit = unit.strip().lower()
    factor = UNIT_TO_ACRES.get(unit, 1.0)
    acres = round(size * factor, 2)
    logger.info("Farm size: %.2f %s → %.2f acres", size, unit, acres)
    return acres


# ═════════════════════════════════════════════════════════════════════
#  Combined Fetch — All environmental data in one call
# ═════════════════════════════════════════════════════════════════════

async def fetch_farm_environment(
    city: str,
    state: str,
) -> Optional[Dict[str, Any]]:
    """
    Fetch all environmental data for a farm location.
    
    1. Geocode city/state → lat/lon
    2. Fetch weather (temperature, humidity, rainfall)
    3. Fetch soil data (N, P, K, pH)
    
    Returns:
        Dict with all environmental parameters, or None if geocoding fails.
    """
    # Step 1: Geocode
    coords = await geocode(city, state)
    if coords is None:
        # Fallback: try with just the state
        coords = await geocode(state, "India")
        if coords is None:
            logger.error("Could not geocode %s, %s", city, state)
            return None

    lat, lon = coords

    # Step 2 & 3: Fetch weather and soil in parallel
    import asyncio
    weather_data, soil_data = await asyncio.gather(
        get_weather(lat, lon),
        get_soil_data(lat, lon, state),
    )

    result = {
        "latitude": lat,
        "longitude": lon,
        "temperature": weather_data["temperature"],
        "humidity": weather_data["humidity"],
        "rainfall": weather_data["rainfall"],
        "N": soil_data["N"],
        "P": soil_data["P"],
        "K": soil_data["K"],
        "ph": soil_data["ph"],
    }

    logger.info("Complete environment for %s, %s: %s", city, state, result)
    return result
