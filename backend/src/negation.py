"""
negation.py — lightweight negation detection for keyword matching.

Catches the common resume-negation pattern ("not experienced in X", "no
knowledge of Y") so that a literal keyword match isn't counted as a
positive signal when the CV is actually disclaiming that skill.

Limitation (documented rather than hidden): this checks whether a lemma
appears *anywhere* near a negation cue in the document, not specifically
at the exact occurrence that satisfied the keyword-presence check. A CV
that mentions a skill twice — once negated, once genuinely — will have
that skill's lemma marked negated everywhere. This is a deliberate,
simple heuristic, consistent with the bag-of-words keyword matching
already used elsewhere in scoring.py, which has the same "which specific
mention" blind spot.
"""

from typing import Set

NEGATION_CUES = {"not", "no", "without", "never", "lack", "lacking", "lacks", "n't"}


def find_negated_lemmas(doc, window: int = 4) -> Set[str]:
    """
    Return the set of lemmas that appear within `window` tokens after a
    negation cue, scoped to the same sentence (so negation in one sentence
    doesn't bleed into the next).

    Requires a spaCy Doc with sentence boundaries available (en_core_web_md
    includes a parser, so doc.sents works out of the box).
    """
    negated = set()

    for sent in doc.sents:
        cue_positions = [
            token.i for token in sent
            if token.lower_ in NEGATION_CUES or token.lower_.endswith("n't")
        ]
        if not cue_positions:
            continue

        for token in sent:
            if token.is_punct:
                continue
            if any(0 <= token.i - cue <= window for cue in cue_positions):
                negated.add(token.lemma_)

    return negated