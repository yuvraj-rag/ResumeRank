"""
conftest.py — ensures the project root is on sys.path so tests can import
`config`, `app.*`, and `src.*` the same way the application code does,
regardless of which directory pytest is invoked from.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))