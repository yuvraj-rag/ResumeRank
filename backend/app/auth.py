"""
auth.py — verifies Supabase-issued JWTs on incoming requests.

Supabase Auth (GoTrue) handles signup/login/session refresh entirely on
the frontend via supabase-js; this backend never sees a password and
never issues a token. Its only job is to verify the bearer token the
frontend attaches to requests and extract the caller's user id.

Supabase has two JWT signing schemes in the wild:
  - Newer projects (Supabase's default since May 2025) sign with an
    asymmetric key (ES256/RS256). These are verified against the
    project's public JSON Web Key Set (JWKS) — no secret needed on this
    backend at all, just the project URL.
  - Older projects may still be on the legacy shared HS256 secret.
    Supabase itself now recommends migrating off this, but it's
    supported here as a fallback so this backend works either way
    without the caller needing to know which scheme their project uses.

JWKS verification is tried first; the shared-secret path only runs if
JWKS verification isn't possible or fails (e.g. a legacy-only project,
where the JWKS endpoint returns no keys).
"""

import logging
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Header, HTTPException, status
from jwt import PyJWKClient

from config import settings

logger = logging.getLogger(__name__)

_AUDIENCE = "authenticated"

_jwks_client: Optional[PyJWKClient] = None
if settings.SUPABASE_URL:
    _jwks_client = PyJWKClient(
        f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json",
        cache_keys=True,
    )


@dataclass(frozen=True)
class AuthUser:
    """The caller, as identified by a verified Supabase JWT."""
    id: str
    email: Optional[str]


def _decode_with_jwks(token: str) -> Optional[dict]:
    if _jwks_client is None:
        return None
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=_AUDIENCE,
        )
    except Exception as e:
        # Covers a bad signature, an expired token, a network/JWKS fetch
        # failure, and a legacy-only project whose JWKS has no keys at
        # all — any of these should fall through to the shared-secret
        # path rather than raise, since that path may still succeed.
        logger.debug("JWKS verification failed, trying legacy secret if configured: %s", e)
        return None


def _decode_with_legacy_secret(token: str) -> Optional[dict]:
    if not settings.SUPABASE_JWT_SECRET:
        return None
    try:
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience=_AUDIENCE,
        )
    except jwt.PyJWTError as e:
        logger.info("Rejected bearer token: %s", e)
        return None


def _decode_bearer_token(authorization: Optional[str]) -> Optional[AuthUser]:
    """
    Decode and verify a `Bearer <jwt>` Authorization header.

    Returns None for any failure — missing header, unconfigured
    Supabase, invalid signature, expired token, etc. None always means
    "treat as anonymous"; this function never raises, callers decide
    whether anonymous is acceptable.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None

    payload = _decode_with_jwks(token) or _decode_with_legacy_secret(token)
    if payload is None:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    return AuthUser(id=user_id, email=payload.get("email"))


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
) -> Optional[AuthUser]:
    """
    FastAPI dependency: the caller if authenticated, else None.

    Used on endpoints that support both signed-in and anonymous callers
    (POST /rank) — anonymous callers get identical behaviour to before
    this feature existed, just without history persistence.
    """
    return _decode_bearer_token(authorization)


async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> AuthUser:
    """
    FastAPI dependency: the caller, or 401 if not authenticated.

    Used on history endpoints, which have no anonymous equivalent —
    there's nothing to list/fetch/delete without a user id to scope the
    query to.
    """
    user = _decode_bearer_token(authorization)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token",
        )
    return user