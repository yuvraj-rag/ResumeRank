"""
logging_config.py — one place to configure logging for the whole project
(both the FastAPI service and the legacy CLI entry point).

Replaces the scattered print() calls in the original main.py with
structured, leveled logging that a real deployment can route to a file,
stdout collector, or log aggregator.
"""

import logging

from config import settings


def configure_logging() -> None:
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )