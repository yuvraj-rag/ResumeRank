"""
pipeline.py — orchestrates the ranking pipeline for a single request:
one job description ranked against a batch of CVs, with optional skill
experience extraction and experience-informed scoring.

This module has no FastAPI-specific code (no Request/Response/UploadFile
types) so it can be called directly — from the API in app/routes.py, from
the legacy CLI in main.py, or from a test — without going through HTTP.
"""

import logging
import os
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from config import settings
from src.experience import extract_experience_for_all
from src.extraction import extract
from src.preprocessing import preprocess
from src.representation import vectorize_documents
from src.scoring import score_cv_against_jd

logger = logging.getLogger(__name__)


class UnsupportedFileError(Exception):
    """Raised when a file's extension is not one of the supported types."""


class FileTooLargeError(Exception):
    """Raised when an uploaded file exceeds the configured size limit."""


def validate_file(filename: str, content: bytes) -> None:
    """Check a file's extension and size before it reaches extraction."""
    ext = Path(filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise UnsupportedFileError(
            f"unsupported file type '{ext}' (allowed: {sorted(settings.ALLOWED_EXTENSIONS)})"
        )

    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.MAX_FILE_SIZE_MB:
        raise FileTooLargeError(
            f"file is {size_mb:.1f} MB, exceeds the {settings.MAX_FILE_SIZE_MB} MB limit"
        )


def extract_text_from_bytes(filename: str, content: bytes) -> str:
    """
    Extract text from raw file bytes.

    extraction.py works on filepaths (fitz.open, Document(), Path.read_text),
    so the bytes are written to a temporary file with the same extension
    before delegating to the existing extract() function — extraction.py
    itself needs no changes to support uploads.
    """
    ext = Path(filename).suffix.lower()
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        return extract(tmp_path)
    finally:
        os.unlink(tmp_path)


def load_cv_texts(files: List[Tuple[str, bytes]]) -> Tuple[Dict[str, str], List[Dict[str, str]]]:
    """
    Validate and extract text for a batch of CV files.

    Returns (texts, errors):
      texts  — {filename: extracted_text} for files that succeeded.
      errors — [{"filename": ..., "error": ...}] for files that failed, so
               the caller can report exactly what went wrong instead of the
               original CLI's silent print-and-skip.
    """
    texts: Dict[str, str] = {}
    errors: List[Dict[str, str]] = []

    for filename, content in files:
        try:
            validate_file(filename, content)
            text = extract_text_from_bytes(filename, content)
        except (UnsupportedFileError, FileTooLargeError) as e:
            logger.warning("Rejected '%s': %s", filename, e)
            errors.append({"filename": filename, "error": str(e)})
            continue
        except Exception as e:
            logger.warning("Extraction failed for '%s': %s", filename, e)
            errors.append({"filename": filename, "error": f"extraction_failed: {e}"})
            continue

        if not text.strip():
            logger.warning("'%s' produced no extractable text", filename)
            errors.append({"filename": filename, "error": "empty_after_extraction"})
            continue

        texts[filename] = text

    return texts, errors


def run_ranking_pipeline(
    jd_filename: str,
    jd_content: bytes,
    cv_files: List[Tuple[str, bytes]],
    extract_experience: bool = False,
    required_skills: Optional[List[str]] = None,
    use_experience_in_score: bool = False,
) -> dict:
    """
    Run the full pipeline: validate + extract the JD and CVs, optionally
    extract skill experience, preprocess, vectorise, and score.

    use_experience_in_score: fold each CV's skill-experience match into
        its final ranking score (src.scoring.score_cv_against_jd). This
        implies extract_experience even if the caller left that flag off,
        since there is no experience data to score against otherwise.

    Returns a dict matching schemas.RankingResponse's shape:
        {"jd_filename", "rankings", "experience", "file_errors"}

    Raises ValueError if the JD fails extraction, if too many CVs were
    submitted, or if no CVs remain after validation — in each case there
    is nothing to rank, and the caller should turn this into an HTTP 400.
    """
    # Scoring with experience requires the data to exist — turn extraction
    # on implicitly rather than silently ignoring the request.
    extract_experience = extract_experience or (use_experience_in_score and bool(required_skills))

    validate_file(jd_filename, jd_content)
    jd_text = extract_text_from_bytes(jd_filename, jd_content)
    if not jd_text.strip():
        raise ValueError(f"job description '{jd_filename}' produced no extractable text")

    if len(cv_files) > settings.MAX_CV_COUNT:
        raise ValueError(
            f"received {len(cv_files)} CVs, exceeds the {settings.MAX_CV_COUNT} limit per request"
        )

    logger.info("Extracting text for %d CV(s)", len(cv_files))
    cv_texts, file_errors = load_cv_texts(cv_files)

    if not cv_texts:
        raise ValueError("no CVs could be processed — see file_errors for details")

    experience_data: Dict[str, dict] = {}
    if extract_experience and required_skills:
        logger.info("Extracting skill experience for %d skill(s)", len(required_skills))
        try:
            experience_data = extract_experience_for_all(cv_texts, required_skills)
        except Exception as e:
            # Experience extraction is a secondary feature — a failure here
            # must not take down the core ranking pipeline.
            logger.warning("Experience extraction failed: %s", e)

    logger.info("Preprocessing job description and %d CV(s)", len(cv_texts))
    clean_jd = {jd_filename: preprocess(jd_text)}
    clean_cvs = {name: preprocess(text) for name, text in cv_texts.items()}

    logger.info("Vectorising documents")
    cv_vectors, jd_vectors, jd_keywords = vectorize_documents(clean_cvs, clean_jd)

    logger.info("Scoring CVs against '%s'", jd_filename)
    ranking = score_cv_against_jd(
        jd_vectors[jd_filename],
        jd_keywords.get(jd_filename, []),
        cv_vectors,
        clean_cvs,
        experience_data=experience_data if use_experience_in_score else None,
        required_skills=required_skills if use_experience_in_score else None,
    )

    return {
        "jd_filename": jd_filename,
        "rankings": ranking,
        "experience": experience_data,
        "file_errors": file_errors,
    }