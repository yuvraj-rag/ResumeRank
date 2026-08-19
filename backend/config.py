"""
config.py — centralized, environment-overridable settings.

Lives at the project root (not inside src/ or app/) so both the core
pipeline modules (src/) and the FastAPI layer (app/) can depend on it
without either one depending on the other.
"""

import os
from dataclasses import dataclass, field
from typing import FrozenSet, List


def _env_float(name: str, default: float) -> float:
    return float(os.getenv(name, default))


def _env_int(name: str, default: int) -> int:
    return int(os.getenv(name, default))


def _env_str(name: str, default: str) -> str:
    return os.getenv(name, default)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_list(name: str, default: List[str]) -> List[str]:
    raw = os.getenv(name)
    if raw is None:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    # --- NLP model ---
    SPACY_MODEL: str = _env_str("SPACY_MODEL", "en_core_web_md")

    # --- Scoring weights (SEMANTIC_WEIGHT + KEYWORD_WEIGHT must sum to 1.0) ---
    SEMANTIC_WEIGHT: float = _env_float("SEMANTIC_WEIGHT", 0.65)
    KEYWORD_WEIGHT: float = _env_float("KEYWORD_WEIGHT", 0.35)

    # --- Keyword extraction / display ---
    TOP_N_KEYWORDS: int = _env_int("TOP_N_KEYWORDS", 15)
    KEYWORD_DISPLAY_LIMIT: int = _env_int("KEYWORD_DISPLAY_LIMIT", 5)

    # Weight each matched keyword by its own TF-IDF importance instead of
    # counting every keyword equally. Toggle-able so it can be rolled back
    # instantly without a code change if it regresses ranking quality.
    KEYWORD_WEIGHTING_ENABLED: bool = _env_bool("KEYWORD_WEIGHTING_ENABLED", True)

    # Expand CV lemmas with known abbreviation/full-form equivalents
    # (JS <-> JavaScript, ML <-> machine learning, ...) before keyword
    # matching, so wording differences alone don't count as a missing keyword.
    SYNONYM_EXPANSION_ENABLED: bool = _env_bool("SYNONYM_EXPANSION_ENABLED", True)

    # Detect negated skill mentions ("not experienced in X") so a literal
    # keyword match isn't treated as a positive signal.
    NEGATION_AWARENESS_ENABLED: bool = _env_bool("NEGATION_AWARENESS_ENABLED", True)
    NEGATION_WINDOW_TOKENS: int = _env_int("NEGATION_WINDOW_TOKENS", 4)

    # --- Experience-informed scoring ---
    # Independent of SEMANTIC_WEIGHT/KEYWORD_WEIGHT — only applied when a
    # caller explicitly opts in (use_experience_in_score) and supplies
    # required_skills. Blend formula:
    #   final = (1 - EXPERIENCE_WEIGHT) * base_score + EXPERIENCE_WEIGHT * experience_score
    EXPERIENCE_WEIGHT: float = _env_float("EXPERIENCE_WEIGHT", 0.2)
    # Years of experience in a skill considered "fully satisfying" it (1.0).
    EXPERIENCE_YEARS_CAP: float = _env_float("EXPERIENCE_YEARS_CAP", 5.0)

    # --- Upload validation ---
    ALLOWED_EXTENSIONS: FrozenSet[str] = field(
        default_factory=lambda: frozenset({".txt", ".pdf", ".docx"})
    )
    MAX_FILE_SIZE_MB: float = _env_float("MAX_FILE_SIZE_MB", 10)
    MAX_CV_COUNT: int = _env_int("MAX_CV_COUNT", 20)

    # --- CORS ---
    # Origins allowed to call this API from a browser. Defaults cover the
    # standard local Next.js dev server; override with a comma-separated
    # list in production, e.g.:
    #   CORS_ORIGINS=https://rankresume.example.com,https://www.rankresume.example.com
    CORS_ORIGINS: List[str] = field(
        default_factory=lambda: _env_list(
            "CORS_ORIGINS",
            ["http://localhost:3000", "http://127.0.0.1:3000"],
        )
    )

    # --- Logging ---
    LOG_LEVEL: str = _env_str("LOG_LEVEL", "INFO")

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


settings = Settings()