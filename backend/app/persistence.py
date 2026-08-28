"""
persistence.py — Supabase-backed history storage for ranking runs.

This module is the only place in the codebase that talks to Supabase
(database rows and Storage objects) for the ranking feature. It is
called from app/routes.py as an optional side-effect after the existing
pipeline in app/pipeline.py has already produced a result — the pipeline
itself has no knowledge that persistence exists.

Every function here is a no-op (returns None / [] / False) when Supabase
isn't configured, so the anonymous / no-Supabase-project code path is
identical to how the app behaved before this feature existed.

All queries are filtered by user_id from the verified JWT (see
app/auth.py) — a caller can never read, list, or delete another user's
run, regardless of what id they pass in the URL. "Not found" and "not
yours" are deliberately indistinguishable to the caller (both come back
as None/False), so routes.py can 404 either way without leaking which
run ids exist. Row Level Security is also enabled on both tables (see
supabase/schema.sql) as a second line of defense, even though this
module uses the service-role key and therefore bypasses it.
"""

import logging
import mimetypes
import uuid
from typing import Dict, List, Optional, Tuple

from app.auth import AuthUser
from app.supabase_client import client
from config import settings

logger = logging.getLogger(__name__)

_RUNS_TABLE = "ranking_runs"
_CVS_TABLE = "ranking_run_cvs"


def _content_type(filename: str) -> str:
    return mimetypes.guess_type(filename)[0] or "application/octet-stream"


def _storage_path(user_id: str, run_id: str, category: str, filename: str) -> str:
    """category is 'jd' or 'cvs'."""
    return f"{user_id}/{run_id}/{category}/{filename}"


def _upload(path: str, content: bytes, filename: str) -> None:
    client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
        path, content, {"content-type": _content_type(filename)}
    )


def save_ranking_run(
    user: AuthUser,
    jd_filename: str,
    jd_content: bytes,
    cv_files: List[Tuple[str, bytes]],
    result: dict,
    extract_experience: bool,
    required_skills: Optional[List[str]],
    use_experience_in_score: bool,
) -> Optional[str]:
    """
    Persist one completed ranking run: uploads the JD and CV files to
    Storage, then writes the run + per-CV rows to Postgres.

    Called from routes.py after run_ranking_pipeline() has already
    succeeded — result is that function's return value, unchanged, and
    the three flag/list params are the same ones already passed into
    run_ranking_pipeline for that request.

    Returns the new ranking_run_id, or None if Supabase isn't configured
    or persistence failed. A failure here is logged and swallowed rather
    than raised: the ranking itself already succeeded and the caller
    should still get their results even if saving history didn't work —
    the same principle already applied to experience extraction in
    app/pipeline.py.
    """
    if not settings.SUPABASE_ENABLED:
        return None

    run_id = str(uuid.uuid4())

    try:
        jd_path = _storage_path(user.id, run_id, "jd", jd_filename)
        _upload(jd_path, jd_content, jd_filename)

        cv_paths: Dict[str, str] = {}
        for filename, content in cv_files:
            path = _storage_path(user.id, run_id, "cvs", filename)
            _upload(path, content, filename)
            cv_paths[filename] = path

        client.table(_RUNS_TABLE).insert({
            "id": run_id,
            "user_id": user.id,
            "jd_filename": jd_filename,
            "jd_storage_path": jd_path,
            "extract_experience": extract_experience,
            "use_experience_in_score": use_experience_in_score,
            "required_skills": required_skills,
            "file_errors": result["file_errors"],
        }).execute()

        cv_rows = []
        for entry in result["rankings"]:
            filename = entry["cv"]
            if filename not in cv_paths:
                # Shouldn't happen — every ranked CV came from cv_files —
                # but skip defensively rather than fail the whole save.
                continue
            cv_rows.append({
                "ranking_run_id": run_id,
                "cv_filename": filename,
                "cv_storage_path": cv_paths[filename],
                "score": entry["score"],
                "semantic_score": entry["semantic_score"],
                "keyword_coverage": entry["keyword_coverage"],
                "experience_score": entry.get("experience_score"),
                "matched": entry["matched"],
                "missing": entry["missing"],
                "experience": result.get("experience", {}).get(filename),
            })

        if cv_rows:
            client.table(_CVS_TABLE).insert(cv_rows).execute()

        return run_id

    except Exception as e:
        logger.warning("Failed to persist ranking run for user %s: %s", user.id, e)
        return None


def list_history(user: AuthUser, limit: int = 50) -> List[dict]:
    """
    Return a summary of the caller's past ranking runs, most recent
    first: id, jd_filename, created_at, and cv_count. Full per-CV detail
    is fetched separately via get_history_run() to keep this list cheap.
    """
    if not settings.SUPABASE_ENABLED:
        return []

    try:
        resp = (
            client.table(_RUNS_TABLE)
            .select("id, jd_filename, created_at")
            .eq("user_id", user.id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        runs = resp.data or []
        if not runs:
            return []

        run_ids = [r["id"] for r in runs if r.get("id")]
        if not run_ids:
            return []

        cv_resp = (
            client.table(_CVS_TABLE)
            .select("ranking_run_id")
            .in_("ranking_run_id", run_ids)
            .execute()
        )
        counts: Dict[str, int] = {}
        for row in cv_resp.data or []:
            run_ref = row.get("ranking_run_id")
            if run_ref:
                counts[run_ref] = counts.get(run_ref, 0) + 1

        return [
            {
                "id": r["id"],
                "jd_filename": r["jd_filename"],
                "created_at": r["created_at"],
                "cv_count": counts.get(r["id"], 0),
            }
            for r in runs
        ]
    except Exception as e:
        logger.warning("Failed to list history for user %s: %s", user.id, e)
        return []


def get_history_run(user: AuthUser, run_id: str) -> Optional[dict]:
    """
    Reconstruct one full ranking run in the same shape as
    schemas.RankingResponse (plus created_at), scoped to the caller.
    """
    if not settings.SUPABASE_ENABLED or not run_id:
        return None

    try:
        run_resp = (
            client.table(_RUNS_TABLE)
            .select("*")
            .eq("id", run_id)
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        run = run_resp.data
        if not run:
            return None

        cv_resp = (
            client.table(_CVS_TABLE)
            .select("*")
            .eq("ranking_run_id", run_id)
            .order("score", desc=True)
            .execute()
        )
        cv_rows = cv_resp.data or []

        rankings = [
            {
                "cv": row["cv_filename"],
                "score": row["score"],
                "semantic_score": row["semantic_score"],
                "keyword_coverage": row["keyword_coverage"],
                "experience_score": row["experience_score"],
                "matched": row["matched"],
                "missing": row["missing"],
            }
            for row in cv_rows
        ]
        experience = {
            row["cv_filename"]: row["experience"]
            for row in cv_rows
            if row.get("experience")
        }

        return {
            "jd_filename": run["jd_filename"],
            "rankings": rankings,
            "experience": experience,
            "file_errors": run.get("file_errors") or [],
            "ranking_run_id": run["id"],
            "created_at": run["created_at"],
        }
    except Exception as e:
        logger.warning("Failed to get history run %s for user %s: %s", run_id, user.id, e)
        return None


def delete_history_run(user: AuthUser, run_id: str) -> bool:
    """
    Delete a run's DB rows (ranking_run_cvs cascades) and its Storage
    objects. Returns False if the run doesn't exist or isn't the
    caller's.
    """
    if not settings.SUPABASE_ENABLED or not run_id:
        return False

    try:
        run_resp = (
            client.table(_RUNS_TABLE)
            .select("id, jd_storage_path")
            .eq("id", run_id)
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        run = run_resp.data
        if not run:
            return False

        cv_resp = (
            client.table(_CVS_TABLE)
            .select("cv_storage_path")
            .eq("ranking_run_id", run_id)
            .execute()
        )

        paths = [
            p
            for p in (
                [run.get("jd_storage_path")]
                + [row.get("cv_storage_path") for row in (cv_resp.data or [])]
            )
            if p
        ]

        if paths:
            try:
                client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).remove(paths)
            except Exception as e:
                # Storage cleanup failing shouldn't block removing the DB record
                # the user asked to delete — log and continue.
                logger.warning("Failed to remove storage objects for run %s: %s", run_id, e)

        client.table(_RUNS_TABLE).delete().eq("id", run_id).eq("user_id", user.id).execute()
        return True
    except Exception as e:
        logger.warning("Failed to delete history run %s for user %s: %s", run_id, user.id, e)
        return False


def get_signed_download_url(user: AuthUser, run_id: str, filename: str) -> Optional[str]:
    """
    Return a short-lived signed URL for one file (the JD or a CV) that
    belongs to the caller's run. None if the run isn't found/owned, or
    filename doesn't match the JD or any CV recorded on that run.
    """
    if not settings.SUPABASE_ENABLED or not run_id or not filename:
        return None

    try:
        run_resp = (
            client.table(_RUNS_TABLE)
            .select("jd_filename, jd_storage_path")
            .eq("id", run_id)
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        run = run_resp.data
        if not run:
            return None

        if filename == run["jd_filename"]:
            path = run.get("jd_storage_path")
        else:
            cv_resp = (
                client.table(_CVS_TABLE)
                .select("cv_storage_path")
                .eq("ranking_run_id", run_id)
                .eq("cv_filename", filename)
                .maybe_single()
                .execute()
            )
            if not cv_resp.data:
                return None
            path = cv_resp.data.get("cv_storage_path")

        if not path:
            return None

        signed = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).create_signed_url(
            path, settings.SIGNED_URL_EXPIRY_SECONDS
        )
        return signed.get("signedURL") or signed.get("signedUrl")
    except Exception as e:
        logger.warning("Failed to get signed download URL for run %s, file %s: %s", run_id, filename, e)
        return None