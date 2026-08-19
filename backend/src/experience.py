import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from dateutil import parser as dateparser


# ---------------------------------------------------------------------------
# Skill matching
# ---------------------------------------------------------------------------


def _skill_pattern(skill: str) -> re.Pattern:
    """Return a regex pattern that matches `skill` as a standalone token.

    Uses negative lookbehind/lookahead to avoid substring matches (e.g., do not match
    'Go' inside 'Google'). Keeps support for symbols in skill names like '+', '#', '.',
    and '-' (C++, C#, Node.js, ASP.NET, Next.js).
    Case-insensitive.
    """
    esc = re.escape(skill)
    # prevent matching when adjacent to word chars (letters, digits, underscore)
    pattern = rf"(?i)(?<![A-Za-z0-9_]){esc}(?![A-Za-z0-9_])"
    return re.compile(pattern)


def _parse_duration_phrase(phrase: str) -> Optional[float]:
    """Parse explicit duration phrases and return years as float.

    Supports: '3 years', '2 yrs', '18 months', '1.5 yr', '2-3 years', '2+ years'.
    Returns None when not parseable or zero.
    """
    if not phrase:
        return None
    p = phrase.lower()
    # normalize common tokens
    p = p.replace("yrs", "year").replace("yrs.", "year").replace("yrs", "year")
    p = p.replace("months", "month").replace("mos", "month")

    # look for patterns like '2-3 years' or '2 - 3 years' or '2 to 3 years'
    m = re.search(r"(\d+(?:[\.,]\d+)?)\s*(?:-|to)\s*(\d+(?:[\.,]\d+)?)\s*(year|month)", p)
    if m:
        a = float(m.group(1).replace(',', '.'))
        b = float(m.group(2).replace(',', '.'))
        unit = m.group(3)
        val = (a + b) / 2.0
        return val / 12.0 if unit.startswith("month") else val

    # single number + unit, possibly with + sign: '2+ years', '18 months'
    m2 = re.search(r"(\d+(?:[\.,]\d+)?)(?:\+)?\s*(year|month)\b", p)
    if m2:
        val = float(m2.group(1).replace(',', '.'))
        unit = m2.group(2)
        return val / 12.0 if unit.startswith("month") else val

    return None


def _find_duration_near(text: str, span: Tuple[int, int], skills: List[str],
                        small_window: int = 80, large_window: int = 200) -> Optional[Tuple[float, str]]:
    """Search for an explicit duration near a matched skill span.

    Returns (years, method) or None. Uses small window first, then large.
    Avoids taking a duration if another skill appears between the duration and the target skill.
    """
    start, end = span

    def search_window(win_left: int, win_right: int) -> Optional[Tuple[float, str]]:
        window = text[win_left:win_right]
        candidates = []
        for m in re.finditer(r"(\d+(?:[\.,]\d+)?(?:\s*(?:-|to)\s*\d+(?:[\.,]\d+)?)?\s*(?:years?|yrs?|months?|mos?)\b)", window, flags=re.I):
            match_start = win_left + m.start()
            match_end = win_left + m.end()
            # distance to skill
            dist = min(abs(match_start - end), abs(match_end - start))
            dur_text = m.group(0)
            years = _parse_duration_phrase(dur_text)
            if years and years > 0:
                # ensure no other skill sits strictly between duration and target
                between_span = (min(end, match_start), max(end, match_start))
                between_text = text[between_span[0]:between_span[1]]
                conflict = False
                for s in skills:
                    if re.search(_skill_pattern(s), between_text):
                        conflict = True
                        break
                if conflict:
                    continue
                candidates.append((years, dist))
        if not candidates:
            return None
        # pick nearest
        candidates.sort(key=lambda x: x[1])
        return candidates[0][0], "explicit_window"

    # small window
    left = max(0, start - small_window)
    right = min(len(text), end + small_window)
    res = search_window(left, right)
    if res:
        return res

    # large window fallback
    left = max(0, start - large_window)
    right = min(len(text), end + large_window)
    return search_window(left, right)


def _extract_date_ranges(block: str) -> List[Tuple[datetime, datetime]]:
    """Extract date ranges found inside a text block using regex and dateparser.

    Returns list of (start_dt, end_dt) for valid ranges. 'Present' or 'Current' maps to now().
    """
    ranges = []
    # common patterns: 'Jan 2020 - Mar 2023', '2020 - 2022', 'Feb 2021 to Present'
    pat = re.compile(r"(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b|\b\d{4}\b)\s*(?:-|–|to)\s*(Present|Current|present|current|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b|\b\d{4}\b)", flags=re.I)
    for m in pat.finditer(block):
        left = m.group(1)
        right = m.group(2)
        try:
            sdt = dateparser.parse(left, default=datetime(1900, 1, 1))
        except Exception:
            continue
        if right.lower() in ("present", "current"):
            edt = datetime.now()
        else:
            try:
                edt = dateparser.parse(right, default=datetime(1900, 1, 1))
            except Exception:
                continue
        if edt and sdt and edt >= sdt:
            ranges.append((sdt, edt))
    return ranges


def _years_between(s: datetime, e: datetime) -> float:
    return max(0.0, (e - s).days / 365.0)


def _split_into_blocks(text: str) -> List[str]:
    """Split CV text into semantic blocks using blank lines and section headings.

    This is intentionally simple and deterministic: splits on 2+ newlines and keeps
    extra short lines attached to neighboring blocks.
    """
    parts = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
    return parts


def _strategy_B_block_inference(cv_text: str, skills: List[str]) -> Dict[str, Tuple[float, str]]:
    """For each provided skill, infer experience by finding dated blocks that mention the skill.

    Returns mapping skill -> (years, method) for skills with at least one valid block-derived duration.
    """
    blocks = _split_into_blocks(cv_text)
    results: Dict[str, float] = {s: 0.0 for s in skills}

    for block in blocks:
        dates = _extract_date_ranges(block)
        if not dates:
            continue
        # merge/choose best interval per block by taking min start and max end
        s_min = min(d[0] for d in dates)
        e_max = max(d[1] for d in dates)
        block_years = _years_between(s_min, e_max)
        for skill in skills:
            if re.search(_skill_pattern(skill), block):
                results[skill] = max(results.get(skill, 0.0), block_years)

    # prepare output dict limited to skills with positive years
    out: Dict[str, Tuple[float, str]] = {}
    for skill, years in results.items():
        if years and years > 0:
            out[skill] = (round(years, 2), "job_block_inference")
    return out


def extract_experience_for_all(cvs: Dict[str, str], skills: List[str]) -> Dict[str, Dict[str, object]]:
    """Main entrypoint: for each CV text, run Strategy A then Strategy B, decide best estimate.

    Returns mapping cv_filename -> { skill: {"years": float, "method": str} }
    Only includes skills where an experience estimate was found.
    """
    results: Dict[str, Dict[str, object]] = {}
    skill_patterns = {s: _skill_pattern(s) for s in skills}

    for name, text in cvs.items():
        name_out: Dict[str, object] = {}

        # find explicit occurrences of each skill
        explicit_hits: Dict[str, List[Tuple[int, int]]] = {s: [] for s in skills}
        for skill in skills:
            pat = skill_patterns[skill]
            for m in pat.finditer(text):
                explicit_hits[skill].append(m.span())

        # Strategy A: explicit window matching
        A_matches: Dict[str, Tuple[float, str]] = {}
        for skill, spans in explicit_hits.items():
            best = None
            for span in spans:
                res = _find_duration_near(text, span, skills=skills)
                if res:
                    years, method = res
                    if years and years > 0:
                        if best is None or years > best[0]:
                            best = (years, method)
            if best:
                A_matches[skill] = (round(best[0], 2), best[1])

        # Strategy B: job block inference
        B_matches = _strategy_B_block_inference(text, skills)

        # Decision layer per skill
        for skill in skills:
            a = A_matches.get(skill)
            b = B_matches.get(skill)
            chosen = None
            if a and a[0] and a[0] > 0:
                # strong explicit match — prefer it
                chosen = {"years": a[0], "method": a[1]}
            elif b and b[0] and b[0] > 0:
                chosen = {"years": b[0], "method": b[1]}
            # if both exist but A is weak (small), prefer B
            if a and b and a[0] and b[0]:
                # if values close within 35% use average
                a_val = a[0]
                b_val = b[0]
                if abs(a_val - b_val) / max(1e-6, max(a_val, b_val)) < 0.35:
                    avg = round((a_val + b_val) / 2.0, 2)
                    chosen = {"years": avg, "method": "cross_validated"}
                else:
                    # otherwise prefer explicit
                    chosen = {"years": a_val, "method": a[1]}

            if chosen:
                results_years = chosen["years"]
                # drop zero or negative
                if results_years and results_years > 0:
                    name_out[skill] = {"years": round(results_years, 2), "method": chosen["method"]}

        if name_out:
            results[name] = name_out

    return results