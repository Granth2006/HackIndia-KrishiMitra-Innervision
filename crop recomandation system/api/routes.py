"""
API Routes
===========
Defines FastAPI endpoints for the Crop Recommendation System.

Endpoints:
  POST /recommend           — Simplified: auto-fetches soil & weather
  POST /recommend_crop      — Advanced: manual soil & weather input
  GET  /health              — Health check
  GET  /model_info          — Model metadata
"""

import logging
import asyncio
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from services.prediction_service import predictor
from services.groq_service import groq_service
from services.location_service import (
    fetch_farm_environment,
    convert_to_acres,
)

# ─── Logger ──────────────────────────────────────────────────────────
logger = logging.getLogger(__name__)

# ─── Router ──────────────────────────────────────────────────────────
router = APIRouter()


# ═════════════════════════════════════════════════════════════════════
#  Request / Response Schemas (Pydantic)
# ═════════════════════════════════════════════════════════════════════

# ─── Simplified Input (NEW — auto-fetch soil & weather) ──────────────

class SimpleFarmInput(BaseModel):
    """
    Simplified input — farmer only enters location and farm info.
    Soil nutrients and weather are automatically fetched.
    """
    city: str = Field(
        ..., min_length=2, max_length=100,
        description="City or village name",
    )
    state: str = Field(
        ..., min_length=2, max_length=100,
        description="Indian state",
    )
    crop_category: str = Field(
        default="grains",
        description="Preferred crop category: grains, pulses, fruits, "
                    "commercial, oilseeds, vegetables, or other",
    )
    previous_crop: str = Field(
        default="unknown",
        min_length=1, max_length=100,
        description="Previously grown crop",
    )
    farm_size: float = Field(
        ..., ge=0.01, le=100000,
        description="Farm size in the specified unit",
    )
    farm_size_unit: str = Field(
        default="acre",
        description="Unit: acre, bigha, or yard",
    )

    @field_validator("crop_category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        valid = {"grains", "pulses", "fruits", "commercial", "oilseeds", "vegetables", "other"}
        v_lower = v.strip().lower()
        if v_lower not in valid:
            raise ValueError(
                f"Invalid crop_category '{v}'. Must be one of: {', '.join(sorted(valid))}"
            )
        return v_lower

    @field_validator("farm_size_unit")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        valid = {"acre", "bigha", "yard"}
        v_lower = v.strip().lower()
        if v_lower not in valid:
            raise ValueError(
                f"Invalid farm_size_unit '{v}'. Must be one of: {', '.join(sorted(valid))}"
            )
        return v_lower

    model_config = {"json_schema_extra": {
        "examples": [{
            "city": "Karnal",
            "state": "Haryana",
            "crop_category": "pulses",
            "previous_crop": "wheat",
            "farm_size": 5,
            "farm_size_unit": "bigha",
        }]
    }}


# ─── Advanced Input (original — manual soil & weather) ───────────────

class FarmInput(BaseModel):
    """
    Advanced input — farmer manually enters all parameters
    including soil nutrients and weather.
    """
    N: float = Field(..., ge=0, le=200, description="Nitrogen content in soil (kg/ha)")
    P: float = Field(..., ge=0, le=200, description="Phosphorus content in soil (kg/ha)")
    K: float = Field(..., ge=0, le=300, description="Potassium content in soil (kg/ha)")
    temperature: float = Field(..., ge=-10, le=60, description="Temperature in °C")
    humidity: float = Field(..., ge=0, le=100, description="Relative humidity (%)")
    ph: float = Field(..., ge=0, le=14, description="Soil pH value")
    rainfall: float = Field(..., ge=0, le=500, description="Rainfall in mm")
    location: str = Field(default="India", min_length=2, max_length=100)
    crop_category: str = Field(default="grains")
    previous_crop: str = Field(default="unknown", min_length=1, max_length=100)
    farm_size: float = Field(default=1.0, ge=0.1, le=10000)

    @field_validator("crop_category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        valid = {"grains", "pulses", "fruits", "commercial", "oilseeds", "vegetables", "other"}
        v_lower = v.strip().lower()
        if v_lower not in valid:
            raise ValueError(f"Invalid crop_category '{v}'.")
        return v_lower

    model_config = {"json_schema_extra": {
        "examples": [{
            "N": 90, "P": 42, "K": 43,
            "temperature": 21, "humidity": 80, "ph": 6.5, "rainfall": 210,
            "location": "Haryana", "crop_category": "pulses",
            "previous_crop": "wheat", "farm_size": 2,
        }]
    }}


# ─── Response Schemas ────────────────────────────────────────────────

class AIInsights(BaseModel):
    """Structured AI insights from Groq."""
    yield_prediction: str
    estimated_profit: str
    fertilizer_recommendation: str
    risk_level: str
    market_demand: str


class CropRecommendation(BaseModel):
    """Single crop recommendation with AI insights."""
    crop: str
    confidence: float
    ai_insights: AIInsights


class EnvironmentData(BaseModel):
    """Auto-fetched environmental data (returned to user for transparency)."""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    temperature: float
    humidity: float
    rainfall: float
    N: float
    P: float
    K: float
    ph: float
    source: str = "Open-Meteo Weather + SoilGrids/ISRIC Satellite Data"


class RecommendationResponse(BaseModel):
    """Full API response with top-3 recommendations."""
    recommendations: List[CropRecommendation]
    environment_data: Optional[EnvironmentData] = None
    farm_size_acres: Optional[float] = None
    model_info: Optional[dict] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model_loaded: bool
    groq_configured: bool


class ModelInfoResponse(BaseModel):
    """Model metadata response."""
    model_name: str
    accuracy: float
    n_classes: int
    feature_names: List[str]
    available_crops: List[str]


# ═════════════════════════════════════════════════════════════════════
#  Helper — Run ML + AI pipeline
# ═════════════════════════════════════════════════════════════════════

async def _run_recommendation_pipeline(
    input_dict: Dict[str, Any],
) -> tuple:
    """
    Common pipeline: ML prediction → Groq insights.
    Returns (recommendations_list, model_info_dict).
    """
    if not predictor.is_loaded:
        predictor.load()

    top_crops = predictor.predict_top_crops(input_dict, top_n=3)

    logger.info(
        "Prediction: top crops = %s",
        [(c["crop"], c["confidence"]) for c in top_crops],
    )

    # Get Groq insights sequentially (rate-limit friendly)
    insights_list = []
    for i, crop_rec in enumerate(top_crops):
        if i > 0:
            await asyncio.sleep(1)
        insight = await groq_service.get_crop_insights(
            crop=crop_rec["crop"],
            confidence=crop_rec["confidence"],
            farm_data=input_dict,
        )
        insights_list.append(insight)

    recommendations = []
    for crop_rec, insights in zip(top_crops, insights_list):
        recommendations.append(
            CropRecommendation(
                crop=crop_rec["crop"],
                confidence=crop_rec["confidence"],
                ai_insights=AIInsights(**insights),
            )
        )

    model_info = {
        "model_name": predictor.meta["model_name"],
        "accuracy": predictor.meta["accuracy"],
    }

    return recommendations, model_info


# ═════════════════════════════════════════════════════════════════════
#  Endpoints
# ═════════════════════════════════════════════════════════════════════

@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
)
async def health_check():
    """Returns the operational status of all system components."""
    return HealthResponse(
        status="healthy",
        model_loaded=predictor.is_loaded,
        groq_configured=groq_service.is_configured,
    )


@router.get(
    "/model_info",
    response_model=ModelInfoResponse,
    summary="Model Information",
)
async def model_info():
    """Returns model metadata: name, accuracy, features, and supported crops."""
    try:
        if not predictor.is_loaded:
            predictor.load()
        meta = predictor.meta
        return ModelInfoResponse(
            model_name=meta["model_name"],
            accuracy=meta["accuracy"],
            n_classes=meta["n_classes"],
            feature_names=meta["feature_names"],
            available_crops=meta["classes"],
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ─── NEW: Simplified endpoint (auto-fetch soil & weather) ────────────

@router.post(
    "/recommend",
    response_model=RecommendationResponse,
    summary="Smart Recommendation (auto-fetch soil & weather)",
    description=(
        "Simplified endpoint — just provide city, state, crop category, "
        "previous crop, and farm size. Soil nutrients and weather data "
        "are automatically fetched from satellite/API sources."
    ),
)
async def recommend_smart(farm_input: SimpleFarmInput):
    """
    Smart recommendation workflow:
      1. Geocode city/state → coordinates
      2. Fetch weather from Open-Meteo
      3. Fetch soil data from SoilGrids + regional database
      4. Convert farm size to acres
      5. Run ML model → top-3 crops
      6. Get Groq AI insights for each crop
      7. Return everything
    """
    try:
        # ── Step 1-3: Fetch environment data ─────────────────
        env = await fetch_farm_environment(
            city=farm_input.city,
            state=farm_input.state,
        )

        if env is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not find location: {farm_input.city}, {farm_input.state}. "
                       "Please check the city and state names.",
            )

        # ── Step 4: Convert farm size ────────────────────────
        farm_size_acres = convert_to_acres(
            farm_input.farm_size, farm_input.farm_size_unit
        )

        # ── Step 5-6: Build input dict & run pipeline ────────
        input_dict = {
            "N": env["N"],
            "P": env["P"],
            "K": env["K"],
            "temperature": env["temperature"],
            "humidity": env["humidity"],
            "ph": env["ph"],
            "rainfall": env["rainfall"],
            "location": farm_input.state,
            "crop_category": farm_input.crop_category,
            "previous_crop": farm_input.previous_crop,
            "farm_size": farm_size_acres,
        }

        recommendations, model_info_dict = await _run_recommendation_pipeline(
            input_dict
        )

        # ── Step 7: Build response ───────────────────────────
        return RecommendationResponse(
            recommendations=recommendations,
            environment_data=EnvironmentData(
                latitude=env.get("latitude"),
                longitude=env.get("longitude"),
                temperature=env["temperature"],
                humidity=env["humidity"],
                rainfall=env["rainfall"],
                N=env["N"],
                P=env["P"],
                K=env["K"],
                ph=env["ph"],
            ),
            farm_size_acres=farm_size_acres,
            model_info=model_info_dict,
        )

    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("Error in /recommend: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Advanced endpoint (original — manual input) ────────────────────

@router.post(
    "/recommend_crop",
    response_model=RecommendationResponse,
    summary="Advanced Recommendation (manual input)",
    description="Provide all parameters manually including soil nutrients and weather.",
)
async def recommend_crop(farm_input: FarmInput):
    """Manual recommendation — user provides all soil & weather data."""
    try:
        input_dict = farm_input.model_dump()
        recommendations, model_info_dict = await _run_recommendation_pipeline(
            input_dict
        )
        return RecommendationResponse(
            recommendations=recommendations,
            model_info=model_info_dict,
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Error in /recommend_crop: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
