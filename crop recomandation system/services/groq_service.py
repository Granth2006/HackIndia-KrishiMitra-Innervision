"""
Groq AI Service
=================
Integrates with the Groq API to generate rich agricultural
insights for recommended crops.

Groq provides ultra-fast LLM inference. Uses the OpenAI-compatible
SDK pointed at https://api.groq.com/openai/v1.

Provides:
  • Yield prediction per hectare
  • Estimated profit range in INR
  • Fertilizer recommendation
  • Crop risk analysis
  • Market demand outlook

The service gracefully degrades if the API key is missing or the
request fails, returning fallback insights instead.
"""

import os
import json
import logging
import re
import asyncio
from typing import Dict, Any

from dotenv import load_dotenv

# ─── Load environment variables (resolve .env from project root) ─────
_ENV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"
)
load_dotenv(_ENV_PATH, override=True)

# ─── Logger ──────────────────────────────────────────────────────────
logger = logging.getLogger(__name__)

# ─── API Key ─────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ─── Groq API Configuration ─────────────────────────────────────────
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_MODEL = "llama-3.3-70b-versatile"


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
#  Fallback Insights (when Groq API is unavailable)
# ═════════════════════════════════════════════════════════════════════

FALLBACK_INSIGHTS: Dict[str, str] = {
    "yield_prediction": "Data unavailable — Groq API not configured",
    "estimated_profit": "Data unavailable — Groq API not configured",
    "fertilizer_recommendation": "General recommendation: NPK balanced fertilizer",
    "risk_level": "Medium",
    "market_demand": "Data unavailable — Groq API not configured",
}


# ═════════════════════════════════════════════════════════════════════
#  Groq Client
# ═════════════════════════════════════════════════════════════════════

class GroqService:
    """
    Manages communication with the Groq API.
    
    Uses the OpenAI-compatible SDK pointed at api.groq.com.
    Falls back to default insights if the API key is not set
    or the request fails.
    """

    def __init__(self):
        self.client = None
        self._configured = False
        self._configure()

    def _configure(self) -> None:
        """Initialize the Groq client using the OpenAI SDK."""
        if not GROQ_API_KEY or GROQ_API_KEY in ("your_groq_api_key_here", ""):
            logger.warning(
                "GROQ_API_KEY not set. AI insights will use fallback values. "
                "Set the key in your .env file to enable Groq integration."
            )
            return

        try:
            from openai import AsyncOpenAI

            self.client = AsyncOpenAI(
                api_key=GROQ_API_KEY,
                base_url=GROQ_BASE_URL,
            )
            self._configured = True
            logger.info("Groq API configured successfully — model: %s", GROQ_MODEL)
        except Exception as e:
            logger.error("Failed to configure Groq API: %s", e)

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
        Extract JSON from the LLM's text response.
        Handles markdown code fences and extra whitespace.
        """
        cleaned = text.strip()
        # Remove markdown code fences if present
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

        try:
            data = json.loads(cleaned)
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
            logger.error("Failed to parse Groq response as JSON: %s", e)
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
            logger.info("Groq not configured; returning fallback insights for %s", crop)
            return FALLBACK_INSIGHTS.copy()

        prompt = self._build_prompt(crop, confidence, farm_data)

        try:
            response = await self.client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an agricultural expert. Always respond with valid JSON only, no extra text.",
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                temperature=0.7,
                max_tokens=500,
            )

            reply = response.choices[0].message.content
            insights = self._parse_response(reply)
            logger.info("Groq insights received for crop: %s", crop)
            return insights

        except Exception as e:
            logger.error(
                "Groq API error for crop %s: %s\nFull error: %r",
                crop, e, e,
            )
            return FALLBACK_INSIGHTS.copy()


# ─── Module-level singleton ──────────────────────────────────────────
groq_service = GroqService()
