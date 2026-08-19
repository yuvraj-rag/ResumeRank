"""
Unit tests for src/experience.py.

Includes a regression test for the Phase 1 fix that removed a bug where
extract_experience_for_all polluted its output with a spurious "dict"
key (results[name_out.__class__.__name__] = ...).
"""

from datetime import datetime

import pytest

from src.experience import (
    _extract_date_ranges,
    _parse_duration_phrase,
    _skill_pattern,
    extract_experience_for_all,
)


# ---------------------------------------------------------------------------
# _skill_pattern
# ---------------------------------------------------------------------------

def test_skill_pattern_matches_standalone_token():
    pattern = _skill_pattern("Go")
    assert pattern.search("I write Go code daily")


def test_skill_pattern_does_not_match_substring_inside_larger_word():
    pattern = _skill_pattern("Go")
    assert not pattern.search("I work at Google")


def test_skill_pattern_matches_symbols():
    pattern = _skill_pattern("C++")
    assert pattern.search("5 years of C++ experience")


# ---------------------------------------------------------------------------
# _parse_duration_phrase
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "phrase,expected",
    [
        ("3 years", 3.0),
        ("2 yrs", 2.0),
        ("18 months", 1.5),
        ("2-3 years", 2.5),
        ("2+ years", 2.0),
    ],
)
def test_parse_duration_phrase_valid(phrase, expected):
    assert _parse_duration_phrase(phrase) == pytest.approx(expected)


def test_parse_duration_phrase_unparseable_returns_none():
    assert _parse_duration_phrase("a long time") is None


def test_parse_duration_phrase_empty_returns_none():
    assert _parse_duration_phrase("") is None


# ---------------------------------------------------------------------------
# _extract_date_ranges
# ---------------------------------------------------------------------------

def test_extract_date_ranges_month_year_range():
    ranges = _extract_date_ranges("Jan 2020 - Mar 2023")
    assert len(ranges) == 1
    start, end = ranges[0]
    assert start.year == 2020
    assert end.year == 2023


def test_extract_date_ranges_year_only_range():
    ranges = _extract_date_ranges("2020 - 2022")
    assert len(ranges) == 1
    start, end = ranges[0]
    assert start.year == 2020
    assert end.year == 2022


def test_extract_date_ranges_present_maps_to_now():
    ranges = _extract_date_ranges("Feb 2021 to Present")
    assert len(ranges) == 1
    _, end = ranges[0]
    assert end.year == datetime.now().year


def test_extract_date_ranges_no_dates_returns_empty():
    assert _extract_date_ranges("no dates in this block at all") == []


# ---------------------------------------------------------------------------
# extract_experience_for_all
# ---------------------------------------------------------------------------

def test_extract_experience_for_all_detects_explicit_duration():
    cvs = {"cv1.txt": "Frontend Developer with 3 years of React experience."}
    result = extract_experience_for_all(cvs, ["React"])
    assert "cv1.txt" in result
    assert result["cv1.txt"]["React"]["years"] == pytest.approx(3.0)


def test_extract_experience_for_all_no_bogus_dict_key():
    """
    Regression test: extract_experience_for_all previously wrote a
    spurious results["dict"] = {} entry into its return value on every
    accepted skill match. This locks in the Phase 1 fix.
    """
    cvs = {"cv1.txt": "Backend Engineer with 4 years of Python experience."}
    result = extract_experience_for_all(cvs, ["Python"])
    assert "dict" not in result


def test_extract_experience_for_all_skips_skill_with_no_evidence():
    cvs = {"cv1.txt": "Backend Engineer with 4 years of Python experience."}
    result = extract_experience_for_all(cvs, ["Python", "Kubernetes"])
    assert "Kubernetes" not in result.get("cv1.txt", {})


def test_extract_experience_for_all_empty_cvs_returns_empty():
    assert extract_experience_for_all({}, ["Python"]) == {}