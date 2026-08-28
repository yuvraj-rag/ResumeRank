"""
supabase_client.py — module-level Supabase client singleton.

Mirrors the pattern already used for the spaCy model in
src/preprocessing.py: build the client once at import time and reuse it,
rather than constructing a new client per request.

This client is built with the SERVICE ROLE key, not the anon key — it is
trusted, server-side-only code that reads/writes any user's row after the
route layer has already checked ownership (see app/auth.py and
app/persistence.py). It must never be exposed to the frontend.

If Supabase isn't configured (no env vars set), `client` is None and
every call site in app/persistence.py checks settings.SUPABASE_ENABLED
first — this keeps local development and the existing test suite working
with zero Supabase project required, exactly as before this feature
existed.
"""

import logging
from typing import Optional

from supabase import Client, create_client

from config import settings

logger = logging.getLogger(__name__)

client: Optional[Client] = None

if settings.SUPABASE_ENABLED:
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    logger.info("Supabase client initialised — persistence and history enabled")
else:
    logger.info("Supabase not configured — running without persistence (anonymous-only)")