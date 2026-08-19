"""
main.py — FastAPI application entrypoint.

Run with:  uvicorn app.main:app --reload
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from logging_config import configure_logging
from src.preprocessing import nlp as spacy_nlp
from app.routes import router

configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RankResume API",
    description=(
        "Classical NLP CV ranking service — TF-IDF and word-vector "
        "similarity, no LLMs or AI APIs."
    ),
    version="1.0.0",
)

# Required for the browser-based Next.js frontend to call this API from a
# different origin (e.g. localhost:3000 -> localhost:8000). Without this,
# every request is blocked by the browser itself before it even reaches
# the routes below. Allowed origins come from settings.CORS_ORIGINS
# (env var CORS_ORIGINS, comma-separated) — update it for your deployed
# frontend's domain in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# The spaCy model loads once, at import time, as a module-level singleton
# in src/preprocessing.py. Storing it on app.state lets GET /health report
# whether it actually loaded, instead of assuming it always does.
app.state.nlp = spacy_nlp
logger.info("spaCy model loaded and ready")

app.include_router(router)