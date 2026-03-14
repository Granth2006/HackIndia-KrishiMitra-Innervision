"""
Gemini AI Service
==================
Integrates with Google's Gemini API to generate rich agricultural
insights for recommended crops.

Provides:
  • Yield prediction per hectare
  • Estimated profit range in INR
  • Fertilizer recommendation
  • Crop risk analysis
  • Market demand outlook

The service gracefully degrades if the API key is missing or the
request fails, returning mock/fallback insights instead.
"""

import os
import json
import logging
import re
from typing import Dict, Any, Optional

from dotenv import load_dotenv

# ─── Load environment variables (resolve .env from project root) ─────
_ENV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"
)
load_dotenv(_ENV_PATH, override=True)

# ─── Logger ──────────────────────────────────────────────────────────
logger = logging.getLogger(__name__)

# ─── API Key ─────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


# ═════════════════════════════════════════════════════════════════════
#  Prompt Template
# ═════════════════════════════════════════════════════════════════════

PROMPT_TEMPLATE = """
You are an experienced agricultural expert specializing in Indian farming.

A farmer has the following farm conditions:

Location: {location}
Farm Size: {farm_size} acres
Previous Crop: {previous_crop}

Soil Conditions:
  Nitrogen (N): {N} kg/ha
  Phosphorus (P): {P} kg/ha
  Potassium (K): {K} kg/ha
  Soil pH: {ph}

Weather Conditions:
  Temperature: {temperature} °C
  Humidity: {humidity} %
  Rainfall: {rainfall} mm

Recommended Crop: {crop}
ML Confidence Score: {confidence}

Based on these conditions, provide the following analysis:

1. Expected yield per hectare (in tons)
2. Estimated profit range in INR (Indian Rupees)
3. Fertilizer recommendation (specific fertilizers and dosage)
4. Crop risk level (low / medium / high) with reasoning
5. Market demand outlook in India (current trends)

IMPORTANT: Return your response ONLY as valid JSON with exactly these keys:
{{
    "yield_prediction": "string with yield range",
    "estimated_profit": "string with INR range",
    "fertilizer_recommendation": "string with fertilizer details",
    "risk_level": "Low or Medium or High",
    "market_demand": "string with market outlook"
}}

Do NOT include any text outside the JSON object.
"""


# ═════════════════════════════════════════════════════════════════════
#  Fallback Insights (when Gemini API is unavailable)
# ═════════════════════════════════════════════════════════════════════

FALLBACK_INSIGHTS: Dict[str, str] = {
    "yield_prediction": "Data unavailable — Gemini API not configured",
    "estimated_profit": "Data unavailable — Gemini API not configured",
    "fertilizer_recommendation": "General recommendation: NPK balanced fertilizer",
    "risk_level": "Medium",
    "market_demand": "Data unavailable — Gemini API not configured",
}


# ═════════════════════════════════════════════════════════════════════
#  Gemini Client
# ═════════════════════════════════════════════════════════════════════

class GeminiService:
    """
    Manages communication with the Google Gemini API.
    
    Falls back to default insights if the API key is not set
    or the request fails.
    """

    def __init__(self):
        self.model = None
        self._configured = False
        self._configure()

    def _configure(self) -> None:
        """Initialize the Gemini client."""
        if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
            logger.warning(
                "GEMINI_API_KEY not set. AI insights will use fallback values. "
                "Set the key in your .env file to enable Gemini integration."
            )
            return

        try:
            import google.generativeai as genai
            genai.configure(api_key=GEMINI_API_KEY)
            self.model = genai.GenerativeModel("gemini-2.0-flash")
            self._configured = True
            logger.info("Gemini API configured successfully.")
        except Exception as e:
            logger.error("Failed to configure Gemini API: %s", e)

    @property
    def is_configured(self) -> bool:
        return self._configured

    def _build_prompt(
        self,
        crop: str,
        confidence: float,
        farm_data: Dict[str, Any],
    ) -> str:
        """Fill in the prompt template with actual farm data."""
        return PROMPT_TEMPLATE.format(
            location=farm_data.get("location", "India"),
            farm_size=farm_data.get("farm_size", 1),
            previous_crop=farm_data.get("previous_crop", "unknown"),
            N=farm_data.get("N", 0),
            P=farm_data.get("P", 0),
            K=farm_data.get("K", 0),
            ph=farm_data.get("ph", 7.0),
            temperature=farm_data.get("temperature", 25),
            humidity=farm_data.get("humidity", 60),
            rainfall=farm_data.get("rainfall", 100),
            crop=crop,
            confidence=confidence,
        )

    def _parse_response(self, text: str) -> Dict[str, str]:
        """
        Extract JSON from Gemini's text response.
        
        The model sometimes wraps JSON in markdown code fences,
        so we strip those first.
        """
        # Remove markdown code fences if present
        cleaned = text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

        try:
            data = json.loads(cleaned)
            # Validate expected keys exist
            expected_keys = {
                "yield_prediction",
                "estimated_profit",
                "fertilizer_recommendation",
                "risk_level",
                "market_demand",
            }
            for key in expected_keys:
                if key not in data:
                    data[key] = "Data not available"
            return data
        except json.JSONDecodeError as e:
            logger.error("Failed to parse Gemini response as JSON: %s", e)
            logger.debug("Raw response: %s", text[:500])
            return FALLBACK_INSIGHTS.copy()

    async def get_crop_insights(
        self,
        crop: str,
        confidence: float,
        farm_data: Dict[str, Any],
    ) -> Dict[str, str]:
        """
        Get AI-generated agricultural insights for a specific crop.
        
        Args:
            crop: Name of the recommended crop.
            confidence: ML model's confidence score (0–1).
            farm_data: Dict of all farm input parameters.
            
        Returns:
            Dict with keys: yield_prediction, estimated_profit,
            fertilizer_recommendation, risk_level, market_demand.
        """
        if not self._configured:
            logger.info("Gemini not configured; returning fallback insights for %s", crop)
            return FALLBACK_INSIGHTS.copy()

        prompt = self._build_prompt(crop, confidence, farm_data)

        try:
            import asyncio
            # Use async API call for non-blocking execution
            response = await self.model.generate_content_async(prompt)
            insights = self._parse_response(response.text)
            logger.info("Gemini insights received for crop: %s", crop)
            return insights

        except Exception as e:
            logger.error(
                "Gemini API error for crop %s: %s\nFull error: %r",
                crop, e, e,
            )
            return FALLBACK_INSIGHTS.copy()


# ─── Module-level singleton ──────────────────────────────────────────
gemini_service = GeminiService()
