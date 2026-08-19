"""
routes.py — HTTP layer for the ranking API.

Translates HTTP concerns (UploadFile, form fields, status codes) into
calls to app.pipeline.run_ranking_pipeline, which contains all the actual
pipeline logic and knows nothing about FastAPI.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status

from app.pipeline import FileTooLargeError, UnsupportedFileError, run_ranking_pipeline
from app.schemas import HealthResponse, RankingResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check(request: Request) -> HealthResponse:
    """Report service health, including whether the spaCy model loaded."""
    model_loaded = bool(getattr(request.app.state, "nlp", None))
    return HealthResponse(
        status="ok" if model_loaded else "degraded",
        spacy_model_loaded=model_loaded,
    )


@router.post("/rank", response_model=RankingResponse, tags=["ranking"])
async def rank_cvs(
    job_description: UploadFile = File(
        ..., description="Single job description file (.txt, .pdf, .docx)"
    ),
    cvs: List[UploadFile] = File(
        ..., description="One or more CV files (.txt, .pdf, .docx)"
    ),
    extract_experience: bool = Form(
        False, description="Toggle skill-experience extraction"
    ),
    required_skills: Optional[str] = Form(
        None,
        description=(
            "Comma-separated list of skills to estimate experience for, "
            "e.g. 'Python,React,SQL'. Ignored if extract_experience is false."
        ),
    ),
    use_experience_in_score: bool = Form(
        False,
        description=(
            "Fold each CV's skill-experience match into its final ranking "
            "score. Requires required_skills; implicitly enables "
            "extract_experience if it wasn't already set."
        ),
    ),
) -> RankingResponse:
    """
    Rank a batch of CVs against a single job description.

    Skill experience is estimated only for skills the caller explicitly
    lists in required_skills — the system does not try to infer which
    skills matter from the job description text.
    """
    jd_bytes = await job_description.read()
    cv_payload = [(cv.filename, await cv.read()) for cv in cvs]

    skills_list = (
        [s.strip() for s in required_skills.split(",") if s.strip()]
        if required_skills
        else None
    )

    try:
        result = run_ranking_pipeline(
            jd_filename=job_description.filename,
            jd_content=jd_bytes,
            cv_files=cv_payload,
            extract_experience=extract_experience,
            required_skills=skills_list,
            use_experience_in_score=use_experience_in_score,
        )
    except (UnsupportedFileError, FileTooLargeError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        logger.exception("Unexpected error while ranking '%s'", job_description.filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing the request.",
        )

    return RankingResponse(**result)