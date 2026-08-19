"""
synonyms.py — small curated abbreviation <-> full-form mapping used to
reduce false "missing keyword" results caused purely by wording
differences (e.g. a CV saying "JS" when the JD says "JavaScript").

Deliberately a short, well-known list rather than an exhaustive one — this
project's stated preference is to start simple and only grow this list
when a specific missed match justifies adding to it.
"""

from typing import List, Set, Tuple

# (abbreviation, full form). Full forms with multiple words are treated as
# a bag of words, matching how keyword phrases are already compared
# elsewhere in the pipeline (no adjacency requirement).
SYNONYM_PAIRS: List[Tuple[str, str]] = [
    ("js", "javascript"),
    ("ts", "typescript"),
    ("ml", "machine learning"),
    ("ai", "artificial intelligence"),
    ("nlp", "natural language processing"),
    ("ui", "user interface"),
    ("ux", "user experience"),
    ("db", "database"),
    ("k8s", "kubernetes"),
    ("ci", "continuous integration"),
    ("cd", "continuous deployment"),
    ("oop", "object oriented programming"),
    ("aws", "amazon web services"),
    ("gcp", "google cloud platform"),
    ("dl", "deep learning"),
    ("qa", "quality assurance"),
    ("api", "application programming interface"),
]


def expand_with_synonyms(lemmas: Set[str]) -> Set[str]:
    """
    Given a set of lemma tokens from a CV, return an expanded set that
    also contains the equivalent abbreviation or full form for any
    recognised synonym pair present.

    Works in both directions:
      - CV has "js"          -> adds "javascript"
      - CV has "javascript"  -> adds "js"
    so a JD keyword phrased either way still matches.
    """
    expanded = set(lemmas)

    for abbrev, full_form in SYNONYM_PAIRS:
        full_tokens = full_form.split()
        has_abbrev = abbrev in lemmas
        has_full_form = all(token in lemmas for token in full_tokens)

        if has_abbrev or has_full_form:
            expanded.add(abbrev)
            expanded.update(full_tokens)

    return expanded