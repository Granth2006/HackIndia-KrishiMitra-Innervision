"""
Smart Sprinkler — AI Crop Recommendation System
=================================================
FastAPI application entry point.

This is the main server that exposes the crop recommendation API
and serves the frontend testing page.

Usage:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

Pages:
    http://localhost:8000        (Frontend)
    http://localhost:8000/docs   (Swagger UI)
    http://localhost:8000/redoc  (ReDoc)
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv

from api.routes import router
from services.prediction_service import predictor

# ─── Load environment variables ──────────────────────────────────────
load_dotenv()

# ─── Logging Configuration ─────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─── Paths ───────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# ═════════════════════════════════════════════════════════════════════
#  Application Lifespan (startup / shutdown hooks)
# ═════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs on application startup and shutdown.
    
    Startup:
      • Pre-load the ML model so the first request isn't slow.
    Shutdown:
      • Log a clean shutdown message.
    """
    # ── Startup ──────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("  🌾 Smart Sprinkler — AI Crop Recommendation System")
    logger.info("=" * 60)
    try:
        predictor.load()
        logger.info("ML model pre-loaded successfully.")
    except FileNotFoundError:
        logger.warning(
            "ML model not found. Train it first: python ml/train_model.py"
        )
    except Exception as e:
        logger.error("Failed to load ML model: %s", e)

    yield  # ← Application runs here

    # ── Shutdown ─────────────────────────────────────────────
    logger.info("Shutting down Smart Sprinkler API. Goodbye! 🌿")


# ═════════════════════════════════════════════════════════════════════
#  FastAPI Application
# ═════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="🌾 Smart Sprinkler — AI Crop Recommendation System",
    description=(
        "An AI-powered agricultural advisory backend that combines "
        "Machine Learning crop predictions with Grok (xAI) insights.\n\n"
        "## Features\n"
        "- **ML-based Crop Recommendation**: Top-3 crops with confidence scores\n"
        "- **AI Agricultural Insights**: Yield, profit, fertilizer, risk & market analysis\n"
        "- **Indian Agriculture Focus**: Optimised for Indian states, crops & conditions\n\n"
        "## Quick Start\n"
        "1. `pip install -r requirements.txt`\n"
        "2. `python data/generate_datasets.py` (if datasets not present)\n"
        "3. `python ml/train_model.py`\n"
        "4. `uvicorn main:app --reload`\n"
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ─── CORS Middleware ─────────────────────────────────────────────────
# Allow all origins for development; restrict in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Register API routes ────────────────────────────────────────────
app.include_router(router, prefix="/api/v1", tags=["Crop Recommendation"])


# ─── Frontend ───────────────────────────────────────────────────────
@app.get("/", tags=["Frontend"], include_in_schema=False)
async def serve_frontend():
    """Serve the frontend HTML page."""
    return FileResponse(
        os.path.join(BASE_DIR, "index.html"),
        media_type="text/html",
    )
