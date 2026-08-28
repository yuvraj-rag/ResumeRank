"""
config.py — centralized application configuration and settings.

Distinguishes between:
  1. Secrets & Environment-Specific Settings (loaded from .env.local)
  2. Normal Application Configuration (constants, defaults, limits, scoring weights)

Configuration Flow:
  .env.local (secrets & environment-specific values)
         ↓
  config.py (central configuration interface & application defaults)
         ↓
  other backend modules
"""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import FrozenSet, List

# --- Centralized Environment Loader ---
_BASE_DIR = Path(__file__).resolve().parent


def _load_env_file_manual(filepath: Path) -> None:
    """Fallback .env parser if python-dotenv is not installed."""
    if not filepath.is_file():
        return
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip()
                if (val.startswith('"') and val.endswith('"')) or (
                    val.startswith("'") and val.endswith("'")
                ):
                    val = val[1:-1]
                os.environ.setdefault(key, val)
    except Exception:
        pass


def _init_environment() -> None:
    """
    Loads secrets and environment-specific overrides from .env.local.
    Falls back to .env if .env.local is not found.
    """
    env_local = _BASE_DIR / ".env.local"
    env_default = _BASE_DIR / ".env"

    target_env = (
        env_local
        if env_local.is_file()
        else (env_default if env_default.is_file() else None)
    )

    if target_env:
        try:
            from dotenv import load_dotenv

            load_dotenv(dotenv_path=target_env, override=False)
        except ImportError:
            _load_env_file_manual(target_env)


# Execute environment loading at module import
_init_environment()


def _env_str(name: str, default: str = "") -> str:
    return os.getenv(name, default)


def _env_list(name: str, default: List[str]) -> List[str]:
    raw = os.getenv(name)
    if raw is None:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    # ==========================================================================
    # 1. Secrets & Environment-Specific Configuration (from .env.local)
    # ==========================================================================

    # --- Supabase Admin & Project Settings ---
    # Service-role key is trusted and server-only. Kept strictly in .env.local.
    SUPABASE_URL: str = _env_str("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = _env_str("SUPABASE_SERVICE_ROLE_KEY", "")

    # Optional legacy shared HS256 secret (blank by default, uses public JWKS).
    SUPABASE_JWT_SECRET: str = _env_str("SUPABASE_JWT_SECRET", "")

    # --- CORS Allowed Origins ---
    # Origins allowed to access the API from browsers (differs per environment).
    CORS_ORIGINS: List[str] = field(
        default_factory=lambda: _env_list(
            "CORS_ORIGINS",
            [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ],
        )
    )

    # ==========================================================================
    # 2. Normal Application Configuration (Fixed Behavior, Limits & Scoring)
    # ==========================================================================

    # --- NLP Model & Logging ---
    SPACY_MODEL: str = "en_core_web_md"
    LOG_LEVEL: str = _env_str("LOG_LEVEL", "INFO")

    # --- Scoring Weights (SEMANTIC_WEIGHT + KEYWORD_WEIGHT must equal 1.0) ---
    SEMANTIC_WEIGHT: float = 0.65
    KEYWORD_WEIGHT: float = 0.35

    # --- Keyword Extraction & Representation ---
    TOP_N_KEYWORDS: int = 15
    KEYWORD_DISPLAY_LIMIT: int = 5
    KEYWORD_WEIGHTING_ENABLED: bool = True
    SYNONYM_EXPANSION_ENABLED: bool = True
    NEGATION_AWARENESS_ENABLED: bool = True
    NEGATION_WINDOW_TOKENS: int = 4

    # --- Skill Experience Extraction & Scoring ---
    EXPERIENCE_WEIGHT: float = 0.2
    EXPERIENCE_YEARS_CAP: float = 5.0

    # --- Upload Validation Limits ---
    ALLOWED_EXTENSIONS: FrozenSet[str] = field(
        default_factory=lambda: frozenset({".txt", ".pdf", ".docx"})
    )
    MAX_FILE_SIZE_MB: float = 10.0
    MAX_CV_COUNT: int = 20

    # --- Supabase Storage Bucket & URL TTL ---
    SUPABASE_STORAGE_BUCKET: str = "rankresume-files"
    SIGNED_URL_EXPIRY_SECONDS: int = 3600

    def __post_init__(self) -> None:
        weight_sum = round(self.SEMANTIC_WEIGHT + self.KEYWORD_WEIGHT, 4)
        if weight_sum != 1.0:
            raise ValueError(
                f"SEMANTIC_WEIGHT + KEYWORD_WEIGHT must equal 1.0, got {weight_sum}"
            )
        if not 0.0 <= self.EXPERIENCE_WEIGHT <= 1.0:
            raise ValueError(
                f"EXPERIENCE_WEIGHT must be between 0.0 and 1.0, got {self.EXPERIENCE_WEIGHT}"
            )

    @property
    def SUPABASE_ENABLED(self) -> bool:
        """
        True once the minimum config needed to write to Supabase is
        present. Checked at every persistence.py call site.
        """
        return bool(self.SUPABASE_URL and self.SUPABASE_SERVICE_ROLE_KEY)


settings = Settings()