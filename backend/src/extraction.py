import re
import statistics
from collections import Counter
from pathlib import Path

import fitz  # PyMuPDF
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph


"""
Text extraction for .txt, .pdf, and .docx resume files.

Design principles
-----------------
PDF
  PyMuPDF's internal renderer produces a block → line → span hierarchy from
  the PDF's own drawing instructions. This means:
  - Line grouping is handled by MuPDF, not inferred. Words on the same
    visual baseline always appear together in one line object.
  - Same-baseline text at different x positions (e.g. job title left, date
    right) land in the same block as two lines sharing the same y0. A 3pt
    y-tolerance merges them into a single output line preserving the
    association.
  - Column layout is detected from the largest gap in block x0 values.
    Left-column blocks are emitted top-to-bottom, then right-column blocks
    top-to-bottom — matching natural resume reading order.
  - Vertical gaps between blocks that exceed 1.5× typical line height are
    preserved as blank lines, giving downstream code reliable section/job-
    block boundaries.
  - Bordered tables are extracted via find_tables() and their bounding boxes
    are used to skip duplicate content in the block pass.

DOCX
  Body children are iterated in document order via the raw XML tree so that
  paragraphs and tables appear in the output exactly as the author placed
  them — not all paragraphs followed by all tables.

All formats
  Tab characters are normalised to spaces. Bullet glyphs become dashes.
  Hyphenated line-breaks are rejoined.

Limitations
  - Scanned / image-only PDFs return empty text (no OCR).
  - Rotated or sidebar PDF text may be missed.
  - Only single- and two-column PDF layouts are handled.
  - Text inside shapes, images, or SmartArt is missed in .docx files.
  - Nested tables in .docx are not recursed into.
"""


# ── Constants ────────────────────────────────────────────────────────────────

# Fraction of page width that must separate two x0 clusters to qualify as
# a two-column layout. 10 % of A4 width ≈ 60 pt ≈ 2 cm — a realistic
# minimum column gutter.
_COLUMN_GAP_RATIO = 0.10

# x0 midpoint of the gap must fall in this relative range to avoid
# misidentifying a narrow left margin or right annotation as a column.
_COLUMN_ZONE = (0.20, 0.80)

# Lines within a block whose y0 values are within this many points are
# considered to be on the same visual row (accounts for mixed font sizes
# shifting the bbox top by 1–3 pt).
_SAME_ROW_Y_TOLERANCE = 3.0

# A gap between consecutive same-column blocks that exceeds this multiple
# of the typical line height is treated as a section/job-block boundary and
# rendered as a blank line.
_BLOCK_GAP_MULTIPLIER = 1.5


# ── TXT ──────────────────────────────────────────────────────────────────────

def extract_txt(filepath: str) -> str:
    try:
        return Path(filepath).read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return Path(filepath).read_text(encoding="latin-1")


# ── DOCX ─────────────────────────────────────────────────────────────────────

def _docx_table_lines(table: Table) -> list[str]:
    """Flatten a table into pipe-separated row strings."""
    lines = []
    for row in table.rows:
        cells = [
            cell.text.strip().replace("\n", " ")
            for cell in row.cells
            if cell.text.strip()
        ]
        if cells:
            lines.append(" | ".join(cells))
    return lines


def extract_docx(filepath: str) -> str:
    """
    Extract text in document order by walking the raw XML body.

    python-docx's .paragraphs and .tables properties iterate their
    respective element types separately, destroying the interleaving order
    that the author established. Iterating doc.element.body directly
    preserves it.
    """
    doc = Document(filepath)
    parts = []

    for child in doc.element.body:
        tag = child.tag
        if tag == qn("w:p"):
            text = Paragraph(child, doc).text.strip()
            if text:
                parts.append(text)
        elif tag == qn("w:tbl"):
            parts.extend(_docx_table_lines(Table(child, doc)))

    return _normalize("\n".join(parts))


# ── PDF — table extraction ────────────────────────────────────────────────────

def _extract_tables(page) -> tuple[list[str], list[tuple]]:
    """
    Extract bordered tables from a page.

    Returns
    -------
    text_lines : list[str]
        Table rows as pipe-separated strings, ready to prepend to body text.
    bboxes : list[tuple]
        (x0, y0, x1, y1) of each found table, used to skip overlapping
        text blocks in the body pass and avoid duplication.
    """
    try:
        finder = page.find_tables()
    except Exception:
        return [], []

    text_lines: list[str] = []
    bboxes: list[tuple] = []

    for tab in finder:
        bboxes.append(tab.bbox)
        for row in tab.extract():
            cells = [str(c).strip() for c in row if c and str(c).strip()]
            if cells:
                text_lines.append(" | ".join(cells))

    return text_lines, bboxes


def _overlaps_any_table(block_bbox: tuple, table_bboxes: list[tuple],
                         threshold: float = 0.40) -> bool:
    """
    Return True if block_bbox overlaps any table bbox by >= threshold
    fraction of the block's area. Prevents double-extraction of table cells.
    """
    bx0, by0, bx1, by1 = block_bbox
    b_area = (bx1 - bx0) * (by1 - by0)
    if b_area <= 0:
        return False
    for tx0, ty0, tx1, ty1 in table_bboxes:
        ix0, iy0 = max(bx0, tx0), max(by0, ty0)
        ix1, iy1 = min(bx1, tx1), min(by1, ty1)
        if ix1 > ix0 and iy1 > iy0:
            if (ix1 - ix0) * (iy1 - iy0) / b_area >= threshold:
                return True
    return False


# ── PDF — layout analysis ─────────────────────────────────────────────────────

def _body_font_size(blocks: list[dict]) -> float:
    """
    Return the median span font size across all blocks.
    Used as a proxy for line height to calibrate gap thresholds.
    Falls back to 11 pt if no spans are found.
    """
    sizes = [
        span["size"]
        for block in blocks
        for line in block.get("lines", [])
        for span in line.get("spans", [])
        if span.get("size", 0) > 0
    ]
    return statistics.median(sizes) if sizes else 11.0


def _find_column_split(blocks: list[dict], page_width: float) -> float | None:
    """
    Detect a two-column layout and return the x-coordinate of the split.

    Strategy: sort all block x0 values and find the largest gap between
    consecutive values. If that gap is large enough (> _COLUMN_GAP_RATIO of
    page width) and the midpoint of the gap falls in the central zone of the
    page (_COLUMN_ZONE), the page is two-column.

    This correctly handles the common resume pattern where one cluster of
    blocks starts near the left margin (~50 pt) and another near the centre-
    right (~300–400 pt), producing a gap of 250–350 pt that is impossible to
    miss.
    """
    if len(blocks) < 3:
        return None

    x0s = sorted(b["bbox"][0] for b in blocks)
    gaps = [
        (x0s[i] - x0s[i - 1], (x0s[i] + x0s[i - 1]) / 2)
        for i in range(1, len(x0s))
    ]

    max_gap, split_midpoint = max(gaps, key=lambda g: g[0])

    lo = page_width * _COLUMN_ZONE[0]
    hi = page_width * _COLUMN_ZONE[1]
    min_gap = page_width * _COLUMN_GAP_RATIO

    if max_gap >= min_gap and lo <= split_midpoint <= hi:
        return split_midpoint

    return None


# ── PDF — block → text conversion ────────────────────────────────────────────

def _block_to_text(block: dict) -> str:
    """
    Convert a single PyMuPDF block dict to a plain-text string.

    Lines within the block that share the same y0 (within _SAME_ROW_Y_TOLERANCE)
    are on the same visual row — they are joined left-to-right with two spaces.
    This correctly handles the case where a job title (left) and a date
    (right) share a baseline but appear as two separate line objects because
    they were placed at different x positions.

    Lines at distinct y0 values are joined with newlines.
    """
    # Accumulate: {y_key: [(x0, text), ...]}
    y_groups: list[tuple[float, list[tuple[float, str]]]] = []

    for line in block.get("lines", []):
        line_text = " ".join(s["text"] for s in line.get("spans", [])).strip()
        if not line_text:
            continue

        line_y = line["bbox"][1]
        line_x = line["bbox"][0]

        # Find an existing y-group within tolerance
        matched = False
        for group_y, items in y_groups:
            if abs(line_y - group_y) <= _SAME_ROW_Y_TOLERANCE:
                items.append((line_x, line_text))
                matched = True
                break
        if not matched:
            y_groups.append((line_y, [(line_x, line_text)]))

    output_lines = []
    for group_y, items in sorted(y_groups, key=lambda g: g[0]):
        # Sort items by x0 so left-to-right reading order is preserved
        row_text = "  ".join(text for _, text in sorted(items, key=lambda i: i[0]))
        output_lines.append(row_text)

    return "\n".join(output_lines)


def _column_to_text(blocks: list[dict], body_font_size: float) -> str:
    """
    Assemble a sequence of same-column blocks into text.

    Inserts a blank line between consecutive blocks whose vertical gap
    exceeds _BLOCK_GAP_MULTIPLIER × line_height. This preserves the
    visual spacing that resume authors use to delimit job blocks,
    education blocks, and skill sections.
    """
    line_height = body_font_size * 1.35
    gap_threshold = line_height * _BLOCK_GAP_MULTIPLIER

    parts: list[str] = []
    prev_bottom: float | None = None

    for block in blocks:
        text = _block_to_text(block)
        if not text:
            continue
        if prev_bottom is not None:
            gap = block["bbox"][1] - prev_bottom
            if gap > gap_threshold:
                parts.append("")  # blank line = block/section boundary
        parts.append(text)
        prev_bottom = block["bbox"][3]

    return "\n".join(parts)


# ── PDF — page pipeline ───────────────────────────────────────────────────────

def _extract_page_text(page) -> str:
    """
    Full extraction pipeline for one PDF page:

    1. Detect and extract bordered tables; record their bboxes.
    2. Load the block/line/span structure from PyMuPDF (sort=False so we
       control ordering ourselves).
    3. Keep only text blocks that do not substantially overlap a table area.
    4. Compute body font size for gap calibration.
    5. Detect single- vs two-column layout from block x0 distribution.
    6. Sort blocks within each column top-to-bottom; assemble with structural
       blank lines.
    7. Prepend table text (tables are full-width, output before body).
    """
    table_lines, table_bboxes = _extract_tables(page)

    page_dict = page.get_text("dict", sort=False)
    text_blocks = [
        b for b in page_dict.get("blocks", [])
        if b["type"] == 0                                      # text only
        and not _overlaps_any_table(b["bbox"], table_bboxes)   # skip table duplicates
    ]

    if not text_blocks:
        body_text = ""
    else:
        font_size = _body_font_size(text_blocks)
        split_x = _find_column_split(text_blocks, page.rect.width)

        if split_x:
            left_blocks = sorted(
                [b for b in text_blocks if b["bbox"][0] < split_x],
                key=lambda b: b["bbox"][1],
            )
            right_blocks = sorted(
                [b for b in text_blocks if b["bbox"][0] >= split_x],
                key=lambda b: b["bbox"][1],
            )
            col_parts = []
            for col in (left_blocks, right_blocks):
                col_text = _column_to_text(col, font_size)
                if col_text.strip():
                    col_parts.append(col_text)
            body_text = "\n\n".join(col_parts)
        else:
            all_blocks = sorted(text_blocks, key=lambda b: b["bbox"][1])
            body_text = _column_to_text(all_blocks, font_size)

    parts = [p for p in ["\n".join(table_lines), body_text] if p.strip()]
    return "\n".join(parts).strip()


# ── PDF — multi-page ─────────────────────────────────────────────────────────

def _remove_repeated_lines(pages: list[str]) -> list[str]:
    """
    Strip lines that appear on a majority of pages (running headers, footers,
    page numbers). A line must appear on more than half the pages and be
    longer than 3 characters to be considered a repeated element.
    """
    if len(pages) < 2:
        return pages

    all_lines = [
        line.strip()
        for page in pages
        for line in page.split("\n")
        if line.strip()
    ]
    counts = Counter(all_lines)
    threshold = len(pages) // 2 + 1
    repeated = {
        line for line, count in counts.items()
        if count >= threshold and len(line) > 3
    }

    return [
        "\n".join(
            line for line in page.split("\n")
            if line.strip() not in repeated
        )
        for page in pages
    ]


def extract_pdf(filepath: str) -> str:
    pages_text: list[str] = []

    with fitz.open(filepath) as pdf:
        for page in pdf:
            text = _extract_page_text(page)
            if text.strip():
                pages_text.append(text)

    if not pages_text:
        return ""

    pages_text = _remove_repeated_lines(pages_text)
    return _normalize("\n\n".join(pages_text))


# ── Shared normalisation ──────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)   # rejoin hyphenated line-breaks
    text = re.sub(r"[•·▪▸◦‣⁃]", "-", text)          # normalise bullet glyphs
    text = re.sub(r"\t+", " ", text)                 # tabs → space
    text = re.sub(r"\n{3,}", "\n\n", text)           # collapse excess blank lines
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    return text.strip()


# ── Public entry point ────────────────────────────────────────────────────────

def extract(filepath: str) -> str:
    suffix = Path(filepath).suffix.lower()

    if suffix == ".txt":
        return extract_txt(filepath)
    if suffix == ".pdf":
        return extract_pdf(filepath)
    if suffix == ".docx":
        return extract_docx(filepath)

    raise ValueError(f"Unsupported file type: {filepath}")