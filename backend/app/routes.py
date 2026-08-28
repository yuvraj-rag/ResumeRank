"""
routes.py — HTTP layer for the ranking API.

Translates HTTP concerns (UploadFile, form fields, status codes) into
calls to app.pipeline.run_ranking_pipeline, which contains all the actual
pipeline logic and knows nothing about FastAPI. History endpoints
similarly delegate all Supabase access to app.persistence.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status

from starlette.concurrency import run_in_threadpool

from app.auth import AuthUser, get_current_user, get_current_user_optional
from app.persistence import (
    delete_history_run,
    get_history_run,
    get_signed_download_url,
    list_history,
    save_ranking_run,
)
from app.pipeline import FileTooLargeError, UnsupportedFileError, run_ranking_pipeline
from app.schemas import (
    HealthResponse,
    HistoryListResponse,
    HistoryRunDetail,
    HistoryRunSummary,
    RankingResponse,
    SignedUrlResponse,
)
from config import settings

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
    user: Optional[AuthUser] = Depends(get_current_user_optional),
) -> RankingResponse:
    """
    Rank a batch of CVs against a single job description.

    Skill experience is estimated only for skills the caller explicitly
    lists in required_skills — the system does not try to infer which
    skills matter from the job description text.

    If the caller is authenticated (a valid Supabase bearer token was
    sent), the run is saved to their history and the response includes
    ranking_run_id. Anonymous callers get identical ranking behaviour to
    before this feature existed, with no persistence.
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

    ranking_run_id = None
    if user is not None:
        ranking_run_id = await run_in_threadpool(
            save_ranking_run,
            user=user,
            jd_filename=job_description.filename,
            jd_content=jd_bytes,
            cv_files=cv_payload,
            result=result,
            extract_experience=extract_experience,
            required_skills=skills_list,
            use_experience_in_score=use_experience_in_score,
        )

    return RankingResponse(**result, ranking_run_id=ranking_run_id)


@router.get("/history", response_model=HistoryListResponse, tags=["history"])
async def get_history(user: AuthUser = Depends(get_current_user)) -> HistoryListResponse:
    """List the caller's past ranking runs, most recent first."""
    runs = await run_in_threadpool(list_history, user)
    return HistoryListResponse(runs=[HistoryRunSummary(**r) for r in runs])


@router.get("/history/{run_id}", response_model=HistoryRunDetail, tags=["history"])
async def get_history_detail(
    run_id: str, user: AuthUser = Depends(get_current_user)
) -> HistoryRunDetail:
    """Fetch one full past ranking run, if it belongs to the caller."""
    run = await run_in_threadpool(get_history_run, user, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ranking run not found")
    return HistoryRunDetail(**run)


@router.delete("/history/{run_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["history"])
async def delete_history(run_id: str, user: AuthUser = Depends(get_current_user)) -> None:
    """Delete one past ranking run (DB rows + stored files), if it belongs to the caller."""
    deleted = await run_in_threadpool(delete_history_run, user, run_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ranking run not found")


@router.get(
    "/history/{run_id}/files/{filename}",
    response_model=SignedUrlResponse,
    tags=["history"],
)
async def get_history_file_url(
    run_id: str, filename: str, user: AuthUser = Depends(get_current_user)
) -> SignedUrlResponse:
    """
    Return a short-lived signed URL to download the original JD or CV
    file for one of the caller's past runs.
    """
    url = await run_in_threadpool(get_signed_download_url, user, run_id, filename)
    if url is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return SignedUrlResponse(url=url, expires_in=settings.SIGNED_URL_EXPIRY_SECONDS)