"""
preprocessing.py — text cleaning and structuring for two pipelines

RANKING PIPELINE
  preprocess(text) -> spaCy Doc
  Used by representation.py and scoring.py. Returns a spaCy Doc on
  lowercased text, ready for lemmatisation and TF-IDF.

SKILL EXTRACTION PIPELINE
  preprocess_for_extraction(text) -> (spaCy Doc, list[str])
  Used by the skill experience feature. Returns a spaCy Doc on
  original-cased text (NER-ready) and a list of blank-line-delimited
  blocks (for python-dateutil and job-block analysis).
"""

import re

import spacy

from config import settings

try:
    nlp = spacy.load(settings.SPACY_MODEL)
except OSError as exc:
    # Previously this printed a message and called sys.exit(1), which kills
    # the interpreter the moment this module is imported — fatal for a test
    # runner or an ASGI server, which should fail startup with a clear error
    # instead of having the whole process disappear.
    raise RuntimeError(
        f"spaCy model '{settings.SPACY_MODEL}' not found. "
        f"Run: python -m spacy download {settings.SPACY_MODEL}"
    ) from exc


# ---------------------------------------------------------------------------
# Step 1 — dash normalisation (runs first, before anything else)
# ---------------------------------------------------------------------------

def _normalize_dashes(text):
    """
    Replace en-dashes and em-dashes with plain hyphens.

    WHY first?
    Resume date ranges use all three characters interchangeably:
    "Jan 2019 – Dec 2022" (en-dash U+2013) and "2019—2022" (em-dash U+2014)
    are just as common as "2019-2022". python-dateutil handles hyphens
    reliably; en/em-dashes may cause silent parse failures in Strategy B.
    spaCy's NER also behaves more predictably with standard hyphens.
    Normalising here means every downstream function sees consistent input.
    """
    text = text.replace("\u2013", "-")  # en-dash
    text = text.replace("\u2014", "-")  # em-dash
    return text


# ---------------------------------------------------------------------------
# Step 2 — noise removal
# ---------------------------------------------------------------------------

def _remove_emails_and_urls(text):
    """Remove email addresses and URLs. Safe for both pipelines."""
    text = re.sub(r"\S+@\S+", " ", text)
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    return text


def _remove_phone_numbers(text):
    """
    Remove phone numbers using format-specific patterns.

    WHY replace the original regex?
    The original pattern was:
        r'[\\+\\(]?[\\d\\s\\-\\(\\)]{7,15}'
    This matches any 7-15 character sequence made up of digits, spaces,
    dashes, and parentheses — which is exactly what date ranges look like.
    "2019 - 2022" is 11 characters, every one of them in [\\d\\s\\-].
    The original regex silently erases dates, which are the primary signal
    for both Strategy A and Strategy B in the extraction feature.

    The patterns below target actual phone number shapes:
      - "(123) 456-7890"   — North American with area code
      - "123-456-7890"     — North American without parentheses
      - "+1 800 555 1234"  — international with country code
      - "9876543210"       — 10+ consecutive digits (mobile, no separators)

    None of these match "2019 - 2022" or "Jan 2019 - Dec 2022" because:
      - Date ranges don't have three separate digit groups of 3-3-4
      - Date ranges don't start with "+"
      - Date ranges never have 10+ consecutive digits
    """
    phone_patterns = [
        r"\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}",               # (123) 456-7890
        r"\+\d{1,3}[\s.\-]\d{3,4}[\s.\-]\d{3,4}[\s.\-]?\d{0,4}",  # +1 800 555 1234
        r"\b\d{10,13}\b",                                       # 10-13 digit mobile
    ]
    for pattern in phone_patterns:
        text = re.sub(pattern, " ", text)
    return text


def remove_noise(text):
    """
    Full noise removal for the ranking pipeline.
    Removes emails, URLs, and phone numbers.
    Safe to call on any text — dates are preserved.
    """
    text = _remove_emails_and_urls(text)
    text = _remove_phone_numbers(text)
    return text


# ---------------------------------------------------------------------------
# Step 3 — structure extraction (extraction pipeline only)
# ---------------------------------------------------------------------------

def split_into_blocks(text):
    """
    Split text into logical blocks separated by blank lines.

    WHY blank-line splitting?
    Resume authors universally use blank lines to separate job entries,
    education records, and skill sections. A blank-line-delimited block
    keeps a date header and its bullet points together in one unit — exactly
    what Strategy B needs to associate a date range with the skills listed
    under it. Splitting by sentence or line would break that association.

    The extraction feature decides which blocks are work experience (those
    containing parseable dates). Preprocessing doesn't need to judge that.

    Returns a list of non-empty stripped strings, one per logical block.
    """
    blocks = re.split(r"\n\s*\n", text)
    return [block.strip() for block in blocks if block.strip()]


# ---------------------------------------------------------------------------
# Pipeline entry points
# ---------------------------------------------------------------------------

def preprocess(text):
    """
    RANKING PIPELINE entry point.

    Cleans text, lowercases it, and returns a spaCy Doc.

    WHY lowercase here?
    Lowercasing normalises the vocabulary for TF-IDF and lemmatisation
    ("Python" and "python" become the same token) and is correct for the
    ranking use case where we want broad term matching.
    It is wrong for the extraction pipeline — see preprocess_for_extraction.
    """
    text = _normalize_dashes(text)
    text = remove_noise(text)
    return nlp(text.lower())


def preprocess_for_extraction(text):
    """
    SKILL EXTRACTION PIPELINE entry point.

    Returns a tuple: (spaCy Doc, list of text blocks).

    WHY a tuple instead of just a Doc?
    Strategy A and Strategy B have different needs:

      Strategy A (window search) needs the spaCy Doc:
        - token.idx gives character positions for the bidirectional window
        - doc.ents of type DATE / CARDINAL locate explicit duration phrases
          reliably, without writing brittle date regexes from scratch

      Strategy B (job block date inference) needs plain string blocks:
        - python-dateutil parses strings, not spaCy objects
        - Blank-line blocks keep date headers and skill bullets together
          so the feature knows which skills lived in which dated job entry

    WHY NOT lowercase here?
    spaCy's NER model is trained on properly-cased text. Lowercasing
    measurably reduces DATE entity detection — and dates are the entire
    signal for Strategy B. Skill names like "C", "R", "Go" also become
    ambiguous against common English words when lowercased.
    Skill matching in the extraction feature should be case-insensitive
    at match time (using .lower() on both sides), not erased at
    preprocessing time.

    WHY only remove emails and URLs, not phone numbers?
    The targeted phone patterns are safe (they don't touch date ranges),
    but for extraction we apply the minimum cleaning possible: only remove
    content that is genuinely never useful (email addresses, URLs).
    Every digit that remains is a potential date component.

    Returns
    -------
    doc    : spaCy Doc  — original casing, positions intact, NER-ready
    blocks : list[str] — blank-line-delimited segments for date parsing
    """
    text = _normalize_dashes(text)
    text = _remove_emails_and_urls(text)

    doc    = nlp(text)               # original case — NER accuracy preserved
    blocks = split_into_blocks(text) # structural segments for dateutil

    return doc, blocks