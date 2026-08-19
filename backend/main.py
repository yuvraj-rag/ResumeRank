"""
main.py — legacy CLI entry point.

Batch-processes every job description in JD_FOLDER against every CV in
CV_FOLDER, writing results to results/result_<timestamp>/ — the same
folder-based workflow as before.

All pipeline logic (validation, extraction, preprocessing, vectorising,
scoring, experience extraction) lives in app/pipeline.py and is shared
with the FastAPI service in app/main.py — this script only reads files
from disk and feeds them into that same pipeline.

Note: this CLI does not write results/<run>/extracted/ (raw extracted
text dumps) or per-CV experience JSON files — those were debug/inspection
conveniences, not core ranking output, and were dropped to keep this
wrapper thin.
"""

import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

from config import settings
from logging_config import configure_logging
from app.pipeline import FileTooLargeError, UnsupportedFileError, run_ranking_pipeline

configure_logging()
logger = logging.getLogger(__name__)

CV_FOLDER = "data/cvs"
JD_FOLDER = "data/job_descriptions"

# Skills to check experience for when SKILL_EXTRACT is enabled.
# The API takes this per-request (required_skills); the CLI has no
# per-request caller, so it stays a module-level list here.
SKILL_EXTRACT = True
REQUIRED_SKILLS = ["React", "Javascript", "Typescript"]

# Fold the skills above into the final ranking score (see
# src.scoring.score_cv_against_jd) instead of only reporting them
# separately. Off by default — this changes ranking order, so it's an
# explicit opt-in rather than a silent behaviour change.
USE_EXPERIENCE_IN_SCORE = False


def make_result_dir() -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = os.path.join("results", f"result_{ts}")
    os.makedirs(os.path.join(base, "scored"), exist_ok=True)
    return base


def read_folder(folder: str) -> list:
    """Return [(filename, bytes), ...] for every supported file in folder."""
    files = []
    if not os.path.isdir(folder):
        return files
    for filename in sorted(os.listdir(folder)):
        if Path(filename).suffix.lower() not in settings.ALLOWED_EXTENSIONS:
            continue
        with open(os.path.join(folder, filename), "rb") as f:
            files.append((filename, f.read()))
    return files


def save_ranking(result: dict, scored_folder: str) -> None:
    jd_filename = result["jd_filename"]
    base = os.path.splitext(jd_filename)[0]
    with open(os.path.join(scored_folder, base + ".txt"), "w", encoding="utf-8") as f:
        f.write(f"Ranking for: {jd_filename}\n")
        f.write("=" * (13 + len(jd_filename)) + "\n\n")
        if not result["rankings"]:
            f.write("No CVs available to rank.\n")
        for rank, item in enumerate(result["rankings"], start=1):
            f.write(f"{rank}. {item['cv']} — {item['score']:.4f}\n")
            if item.get("experience_score") is not None:
                f.write(f"   experience_match: {item['experience_score']:.4f}\n")
            if item["matched"]:
                f.write(f"   matched: {', '.join(item['matched'])}\n")
            if item["missing"]:
                f.write(f"   missing: {', '.join(item['missing'])}\n")
        if result["file_errors"]:
            f.write("\nFiles skipped:\n")
            for err in result["file_errors"]:
                f.write(f"  - {err['filename']}: {err['error']}\n")
        f.write("\n")


if __name__ == "__main__":
    cv_files = read_folder(CV_FOLDER)
    jd_files = read_folder(JD_FOLDER)

    if not cv_files:
        logger.error("No CVs found in '%s'. Add .txt, .pdf, or .docx files and try again.", CV_FOLDER)
        sys.exit(0)

    if not jd_files:
        logger.error("No job descriptions found in '%s'. Add .txt files and try again.", JD_FOLDER)
        sys.exit(0)

    result_dir = make_result_dir()
    logger.info("Results → %s", result_dir)

    all_results = []
    for jd_filename, jd_content in jd_files:
        logger.info("Ranking CVs against '%s'", jd_filename)
        try:
            result = run_ranking_pipeline(
                jd_filename=jd_filename,
                jd_content=jd_content,
                cv_files=cv_files,
                extract_experience=SKILL_EXTRACT,
                required_skills=REQUIRED_SKILLS if SKILL_EXTRACT else None,
                use_experience_in_score=USE_EXPERIENCE_IN_SCORE,
            )
        except (UnsupportedFileError, FileTooLargeError, ValueError) as e:
            logger.error("Skipping '%s': %s", jd_filename, e)
            continue

        for err in result["file_errors"]:
            logger.warning("  [skip] %s: %s", err["filename"], err["error"])

        save_ranking(result, os.path.join(result_dir, "scored"))
        all_results.append(result)

    with open(os.path.join(result_dir, "result.json"), "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2)

    logger.info("All done. Open %s to see results.", result_dir)