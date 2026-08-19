"""
schemas.py — Pydantic request/response models for the ranking API.

These double as the API's data contract: FastAPI uses them for request
validation and automatic OpenAPI docs, and routes.py builds the response
directly from these models instead of passing raw dicts to the client.
"""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class FileError(BaseModel):
    """A CV or JD file that could not be processed, and why."""
    filename: str
    error: str


class CVRankingEntry(BaseModel):
    """One CV's score against the job description."""
    cv: str
    score: float
    semantic_score: float
    keyword_coverage: float
    experience_score: Optional[float] = None
    matched: List[str]
    missing: List[str]


class ExperienceDetail(BaseModel):
    """Estimated experience for a single skill, for a single CV."""
    years: float
    method: str


class RankingResponse(BaseModel):
    """Response body for POST /rank."""
    jd_filename: str
    rankings: List[CVRankingEntry]
    experience: Dict[str, Dict[str, ExperienceDetail]] = Field(default_factory=dict)
    file_errors: List[FileError] = Field(default_factory=list)


class HealthResponse(BaseModel):
    """Response body for GET /health."""
    status: str
    spacy_model_loaded: bool