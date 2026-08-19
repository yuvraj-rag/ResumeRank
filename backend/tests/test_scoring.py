"""
Unit tests for src/scoring.py.

Uses the project's real spaCy pipeline (via src.preprocessing.preprocess)
to build test documents rather than mocking spaCy's Doc/Token classes,
which are C-extension types that are impractical to fake convincingly.
The model is already a hard dependency of the project, so this adds no
new cost to running the test suite.
"""

import numpy as np
import pytest

from src.preprocessing import preprocess
from src.scoring import (
    experience_match_score,
    score_cv_against_jd,
    semantic_similarity,
    split_keywords,
)


# ---------------------------------------------------------------------------
# semantic_similarity
# ---------------------------------------------------------------------------

def test_semantic_similarity_zero_vector_returns_zero():
    zero = np.zeros(10)
    nonzero = np.ones(10)
    assert semantic_similarity(zero, nonzero) == 0.0
    assert semantic_similarity(nonzero, zero) == 0.0
    assert semantic_similarity(zero, zero) == 0.0


def test_semantic_similarity_identical_vectors_returns_one():
    vec = np.array([1.0, 2.0, 3.0])
    assert semantic_similarity(vec, vec) == pytest.approx(1.0)


def test_semantic_similarity_orthogonal_vectors_returns_zero():
    a = np.array([1.0, 0.0])
    b = np.array([0.0, 1.0])
    assert semantic_similarity(a, b) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# split_keywords
# ---------------------------------------------------------------------------

def test_split_keywords_no_jd_keywords_returns_empty():
    cv_doc = preprocess("python django postgresql")
    matched, missing, coverage = split_keywords([], cv_doc)
    assert matched == []
    assert missing == []
    assert coverage == 0.0


def test_split_keywords_basic_match_and_miss():
    cv_doc = preprocess("experienced python developer with django")
    jd_keywords = [("python", 1.0), ("docker", 1.0)]
    matched, missing, coverage = split_keywords(jd_keywords, cv_doc)
    assert matched == ["python"]
    assert missing == ["docker"]
    assert coverage == pytest.approx(0.5)


def test_split_keywords_weighted_coverage_reflects_weight_not_count():
    cv_doc = preprocess("experienced python developer")
    # "python" carries far more weight than "docker" — matching it alone
    # should give high coverage even though only 1 of 2 keywords matched.
    jd_keywords = [("python", 9.0), ("docker", 1.0)]
    _, _, coverage = split_keywords(jd_keywords, cv_doc)
    assert coverage == pytest.approx(0.9)


def test_split_keywords_synonym_expansion_matches_abbreviation():
    cv_doc = preprocess("built frontend apps using js")
    jd_keywords = [("javascript", 1.0)]
    matched, missing, _ = split_keywords(jd_keywords, cv_doc)
    assert "javascript" in matched


def test_split_keywords_synonym_expansion_matches_full_form():
    cv_doc = preprocess("solid experience with javascript")
    jd_keywords = [("js", 1.0)]
    matched, missing, _ = split_keywords(jd_keywords, cv_doc)
    assert "js" in matched


def test_split_keywords_negation_excludes_negated_skill():
    cv_doc = preprocess("not experienced in python but strong in java")
    jd_keywords = [("python", 1.0), ("java", 1.0)]
    matched, missing, _ = split_keywords(jd_keywords, cv_doc)
    assert "python" in missing
    assert "java" in matched


# ---------------------------------------------------------------------------
# experience_match_score
# ---------------------------------------------------------------------------

def test_experience_match_score_no_required_skills_returns_zero():
    assert experience_match_score({}, [], cap=5.0) == 0.0


def test_experience_match_score_full_credit_at_or_above_cap():
    cv_experience = {"react": {"years": 6.0, "method": "explicit_window"}}
    score = experience_match_score(cv_experience, ["react"], cap=5.0)
    assert score == pytest.approx(1.0)


def test_experience_match_score_partial_credit_below_cap():
    cv_experience = {"react": {"years": 2.5, "method": "explicit_window"}}
    score = experience_match_score(cv_experience, ["react"], cap=5.0)
    assert score == pytest.approx(0.5)


def test_experience_match_score_missing_skill_contributes_zero():
    cv_experience = {"react": {"years": 5.0, "method": "explicit_window"}}
    score = experience_match_score(cv_experience, ["react", "typescript"], cap=5.0)
    assert score == pytest.approx(0.5)  # react=1.0, typescript=0.0, mean=0.5


# ---------------------------------------------------------------------------
# score_cv_against_jd
# ---------------------------------------------------------------------------

def test_score_cv_against_jd_ranks_higher_semantic_match_first():
    jd_vector = np.array([1.0, 0.0])
    cv_vectors = {
        "close.txt": np.array([1.0, 0.0]),
        "far.txt": np.array([0.0, 1.0]),
    }
    cv_docs = {
        "close.txt": preprocess("python developer"),
        "far.txt": preprocess("sales associate"),
    }
    ranking = score_cv_against_jd(jd_vector, [], cv_vectors, cv_docs)
    assert ranking[0]["cv"] == "close.txt"
    assert ranking[0]["score"] >= ranking[1]["score"]
    # experience wasn't requested, so the field is present but empty
    assert ranking[0]["experience_score"] is None


def test_score_cv_against_jd_blends_experience_when_provided():
    jd_vector = np.array([1.0, 0.0])
    cv_vectors = {"cv.txt": np.array([1.0, 0.0])}
    cv_docs = {"cv.txt": preprocess("python developer")}
    experience_data = {"cv.txt": {"python": {"years": 5.0, "method": "explicit_window"}}}

    ranking = score_cv_against_jd(
        jd_vector, [], cv_vectors, cv_docs,
        experience_data=experience_data,
        required_skills=["python"],
        experience_weight=0.5,
    )
    entry = ranking[0]
    # base_score = 0.65 * semantic(1.0) + 0.35 * keyword_coverage(0.0) = 0.65
    # experience_score = 1.0 (5 years >= default 5-year cap)
    # final = (1 - 0.5) * 0.65 + 0.5 * 1.0 = 0.825
    assert entry["experience_score"] == pytest.approx(1.0)
    assert entry["score"] == pytest.approx(0.825)   