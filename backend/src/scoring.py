import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from config import settings
from src.negation import find_negated_lemmas
from src.synonyms import expand_with_synonyms


def semantic_similarity(jd_vector, cv_vector):
    # cosine is undefined for zero vectors — treat as no similarity
    if not np.any(jd_vector) or not np.any(cv_vector):
        return 0.0
    return float(cosine_similarity([jd_vector], [cv_vector])[0][0])


def split_keywords(jd_keywords, cv_doc):
    """
    Compare a JD's weighted keywords against one CV's tokens.

    jd_keywords: list of (keyword, weight) tuples, as produced by
    representation.get_top_keywords(). weight is that keyword's own
    TF-IDF importance (or 1.0 for every keyword when keyword weighting is
    disabled, reproducing the original "every keyword counts equally"
    behaviour).

    Returns (matched, missing, keyword_coverage) where keyword_coverage is
    the fraction of *weight* matched, not just count — so matching a
    highly job-specific keyword contributes more than matching an
    incidental one.
    """
    if not jd_keywords:
        return [], [], 0.0

    cv_lemmas = {token.lemma_ for token in cv_doc if not token.is_punct}

    # Negation must be checked against the literal tokens that actually
    # appear in the CV, before synonym expansion injects tokens that were
    # never written by the candidate and have no real position to check.
    negated_lemmas = (
        find_negated_lemmas(cv_doc, window=settings.NEGATION_WINDOW_TOKENS)
        if settings.NEGATION_AWARENESS_ENABLED
        else set()
    )

    if settings.SYNONYM_EXPANSION_ENABLED:
        cv_lemmas = expand_with_synonyms(cv_lemmas)

    matched, missing = [], []
    matched_weight, total_weight = 0.0, 0.0

    for keyword, weight in jd_keywords:
        total_weight += weight
        parts = keyword.split()
        present = all(p in cv_lemmas for p in parts)
        negated = any(p in negated_lemmas for p in parts)

        if present and not negated:
            matched.append(keyword)
            matched_weight += weight
        else:
            missing.append(keyword)

    coverage = matched_weight / total_weight if total_weight > 0 else 0.0
    return matched, missing, coverage


def experience_match_score(cv_experience, required_skills, cap=None):
    """
    Convert one CV's extracted skill-experience data into a single 0-1
    score against a list of required skills.

    Each skill contributes years_found / cap (capped at 1.0), so a skill
    with no detected experience contributes 0 rather than disqualifying
    the CV outright — this rewards partial matches instead of being an
    all-or-nothing filter. The final score is the mean across all
    required_skills.

    cv_experience: this CV's entry from
                   experience.extract_experience_for_all(), i.e.
                   {skill: {"years": float, "method": str}}.
    required_skills: the skills the caller asked to be scored on.
    cap: years at which a skill is considered "fully" satisfied.
         Defaults to settings.EXPERIENCE_YEARS_CAP.
    """
    if not required_skills:
        return 0.0

    cap = settings.EXPERIENCE_YEARS_CAP if cap is None else cap
    if cap <= 0:
        return 0.0

    total = 0.0
    for skill in required_skills:
        entry = cv_experience.get(skill)
        years = entry["years"] if entry else 0.0
        total += min(years / cap, 1.0)

    return total / len(required_skills)


def score_cv_against_jd(
    jd_vector,
    jd_keywords,
    cv_vectors,
    cv_docs,
    semantic_weight=None,
    keyword_weight=None,
    keyword_display_limit=None,
    experience_data=None,
    required_skills=None,
    experience_weight=None,
):
    """
    Score every CV against one JD.

    experience_data / required_skills are optional. When both are provided
    (non-empty), each CV's score becomes a blend of the base semantic +
    keyword score and its experience_match_score, weighted by
    experience_weight (defaults to settings.EXPERIENCE_WEIGHT):

        final = (1 - experience_weight) * base_score + experience_weight * experience_score

    When either is omitted, scoring is unchanged from the base formula and
    "experience_score" is reported as None — existing callers that don't
    pass these get identical behaviour to before this feature existed.
    """
    semantic_weight = settings.SEMANTIC_WEIGHT if semantic_weight is None else semantic_weight
    keyword_weight = settings.KEYWORD_WEIGHT if keyword_weight is None else keyword_weight
    keyword_display_limit = (
        settings.KEYWORD_DISPLAY_LIMIT if keyword_display_limit is None else keyword_display_limit
    )
    experience_weight = settings.EXPERIENCE_WEIGHT if experience_weight is None else experience_weight

    use_experience = bool(experience_data is not None and required_skills)

    ranking = []
    for cv_name, cv_vector in cv_vectors.items():
        sem                   = semantic_similarity(jd_vector, cv_vector)
        matched, missing, cov = split_keywords(jd_keywords, cv_docs[cv_name])
        base_score            = semantic_weight * sem + keyword_weight * cov

        entry = {
            "cv":               cv_name,
            "semantic_score":   round(sem, 4),
            "keyword_coverage": round(cov, 4),
            "matched":          matched[:keyword_display_limit],
            "missing":          missing[:keyword_display_limit],
        }

        if use_experience:
            exp_score = experience_match_score(
                experience_data.get(cv_name, {}), required_skills
            )
            final_score = (1 - experience_weight) * base_score + experience_weight * exp_score
            entry["experience_score"] = round(exp_score, 4)
        else:
            final_score = base_score
            entry["experience_score"] = None

        entry["score"] = round(final_score, 4)
        ranking.append(entry)

    ranking.sort(key=lambda x: x["score"], reverse=True)
    return ranking


def rank_all_cvs(jd_vectors, cv_vectors, jd_keywords, cv_docs, **kwargs):
    return {
        jd_name: score_cv_against_jd(
            jd_vector,
            jd_keywords.get(jd_name, []),
            cv_vectors,
            cv_docs,
            **kwargs,
        )
        for jd_name, jd_vector in jd_vectors.items()
    }