from __future__ import annotations

import io
import re
import shutil
from dataclasses import dataclass
from typing import Iterable

import fitz
import numpy as np

try:
    import pytesseract
    from PIL import Image
except ImportError:  # pragma: no cover - optional OCR dependency
    pytesseract = None
    Image = None

try:
    from rapidocr_onnxruntime import RapidOCR
except ImportError:  # pragma: no cover - optional OCR dependency
    RapidOCR = None


TIME_PATTERN = re.compile(
    r"(?P<time>"
    r"(?:\b\d{1,2}(?::|\.)\d{2}\s*(?:AM|PM)?\s*(?:-|–|to)\s*\d{1,2}(?::|\.)\d{2}\s*(?:AM|PM)?\b)"
    r"|(?:\b\d{1,2}\s*(?:AM|PM)\s*(?:-|–|to)\s*\d{1,2}\s*(?:AM|PM)\b)"
    r")",
    re.IGNORECASE,
)
ROOM_LABEL_PATTERN = re.compile(
    r"\b(?:room|rm|lab|hall|classroom|block|venue)\s*[:.-]?\s*(?P<room>[A-Z0-9-]{1,20}(?:\s+[A-Z0-9-]{1,20})?)",
    re.IGNORECASE,
)
ROOM_FALLBACK_PATTERN = re.compile(r"\b(?:[A-Z]{1,4}[- ]?\d{2,4}|Room\s*\d{1,4}|Lab\s*[A-Z0-9-]{1,10})\b", re.IGNORECASE)
SUBJECT_CLEANUP_PATTERN = re.compile(r"\s{2,}")
NOISE_PATTERN = re.compile(
    r"\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|session|period|slot|time|room|venue)\b",
    re.IGNORECASE,
)


@dataclass
class ParseResult:
    entries: list[dict[str, str]]
    parser_method: str
    notes: list[str]


_rapidocr_engine: RapidOCR | None = None


def extract_timetable_entries(pdf_bytes: bytes) -> ParseResult:
    table_entries = extract_timetable_from_tables(pdf_bytes)
    if table_entries:
        return ParseResult(
            entries=table_entries,
            parser_method="table",
            notes=["Parsed using PDF table extraction."],
        )

    raw_text = extract_pdf_text(pdf_bytes)
    entries = parse_timetable_text(raw_text)
    if entries:
        return ParseResult(entries=entries, parser_method="text", notes=["Parsed using embedded PDF text."])

    notes = [
        "No structured timetable rows were found in the embedded PDF text.",
    ]

    ocr_text, ocr_method = extract_pdf_text_with_ocr(pdf_bytes)
    if ocr_text:
        ocr_entries = parse_timetable_text(ocr_text)
        if ocr_entries:
            return ParseResult(
                entries=ocr_entries,
                parser_method=ocr_method,
                notes=[f"Parsed using {ocr_method} OCR fallback after text extraction produced no entries."],
            )
        notes.append(f"{ocr_method} OCR fallback ran but still could not detect subject, time, and room rows.")
    else:
        notes.append(
            "OCR fallback is unavailable. Install the `tesseract` binary or the `rapidocr-onnxruntime` package to parse scanned PDFs."
        )

    return ParseResult(entries=[], parser_method="unparsed", notes=notes)


def extract_timetable_from_tables(pdf_bytes: bytes) -> list[dict[str, str]]:
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        table_data = []
        for page in document:
            if not hasattr(page, "find_tables"):
                continue
            found_tables = page.find_tables()
            for table in found_tables.tables:
                extracted = table.extract()
                if extracted:
                    table_data.append(extracted)
    finally:
        document.close()

    if not table_data:
        return []

    summary_map = build_summary_map(table_data)
    timetable_entries = build_timetable_entries(table_data, summary_map)
    deduped: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    for entry in timetable_entries:
        key = (
            entry["subject_name"].lower(),
            entry["time"].lower(),
            entry["room_number"].lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)
    return deduped


def build_summary_map(tables: list[list[list[str | None]]]) -> dict[str, dict[str, str]]:
    summary_map: dict[str, dict[str, str]] = {}
    for table in tables:
        header = [normalize_spaces(cell or "") for cell in table[0]]
        if not header or "Abbreviation" not in header[0]:
            continue

        for row in table[1:]:
            if len(row) < 7:
                continue
            abbreviation_cell = normalize_spaces(row[0] or "")
            subject_name = normalize_spaces(row[2] or "")
            room_number = normalize_spaces(row[6] or "")
            if not abbreviation_cell:
                continue
            for alias in split_summary_aliases(abbreviation_cell):
                summary_map[alias] = {
                    "subject_name": subject_name or alias,
                    "room_number": room_number,
                }
    return summary_map


def split_summary_aliases(value: str) -> list[str]:
    aliases = [normalize_spaces(part) for part in value.split(",") if normalize_spaces(part)]
    return aliases or [normalize_spaces(value)]


def build_timetable_entries(
    tables: list[list[list[str | None]]],
    summary_map: dict[str, dict[str, str]],
) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    known_aliases = sorted(summary_map.keys(), key=len, reverse=True)

    for table in tables:
        header = [normalize_spaces(cell or "") for cell in table[0]]
        if not header or header[0] != "Day/Period":
            continue

        time_slots = [normalize_spaces(cell or "") for cell in header[1:]]
        for row in table[1:]:
            if not row:
                continue
            day_name = normalize_spaces(row[0] or "")
            if not day_name:
                continue

            for index, cell in enumerate(row[1:], start=1):
                if index >= len(header):
                    continue
                cell_text = normalize_spaces(cell or "")
                if not cell_text or cell_text.lower() == "lunch":
                    continue

                time_label = f"{day_name} {time_slots[index - 1]}"
                cell_entries = parse_table_cell(cell_text, time_label, summary_map, known_aliases)
                entries.extend(cell_entries)

    return entries


def parse_table_cell(
    cell_text: str,
    time_label: str,
    summary_map: dict[str, dict[str, str]],
    known_aliases: list[str],
) -> list[dict[str, str]]:
    matched_aliases = []
    for alias in known_aliases:
        if alias in cell_text:
            matched_aliases.append(alias)

    unique_aliases = []
    for alias in matched_aliases:
        if not any(alias in other and alias != other for other in matched_aliases):
            unique_aliases.append(alias)

    if unique_aliases:
        return [
            {
                "subject_name": summary_map.get(alias, {}).get("subject_name", alias),
                "time": time_label,
                "room_number": summary_map.get(alias, {}).get("room_number") or extract_room(cell_text) or "TBA",
            }
            for alias in unique_aliases
        ]

    room_value = extract_room(cell_text)
    subject_value = normalize_spaces(re.sub(r"\([^)]*\)", " ", cell_text))
    subject_value = SUBJECT_CLEANUP_PATTERN.sub(" ", subject_value).strip(" -|:")
    if not subject_value:
        return []
    return [
        {
            "subject_name": subject_value,
            "time": time_label,
            "room_number": room_value or "TBA",
        }
    ]


def extract_pdf_text(pdf_bytes: bytes) -> str:
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    page_text: list[str] = []
    try:
        for page in document:
            parts = [page.get_text("text")]
            blocks = [
                normalize_spaces(block[4])
                for block in page.get_text("blocks")
                if len(block) > 4 and normalize_spaces(block[4])
            ]
            if blocks:
                parts.append("\n".join(blocks))
            page_text.append("\n".join(part for part in parts if part.strip()))
    finally:
        document.close()
    return "\n".join(page_text)


def extract_pdf_text_with_ocr(pdf_bytes: bytes) -> tuple[str, str]:
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page_text: list[str] = []
        for page in document:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            image_bytes = pixmap.tobytes("png")
            ocr_page_text = extract_image_text_with_available_ocr(image_bytes)
            if ocr_page_text:
                page_text.append(ocr_page_text)
    finally:
        document.close()
    combined = "\n".join(page_text)
    if not combined:
        return "", "ocr"
    method = "tesseract" if is_tesseract_available() else "rapidocr"
    return combined, method


def is_ocr_available() -> bool:
    return is_tesseract_available() or is_rapidocr_available()


def is_tesseract_available() -> bool:
    return bool(pytesseract and Image and shutil.which("tesseract"))


def is_rapidocr_available() -> bool:
    return RapidOCR is not None and Image is not None


def extract_image_text_with_available_ocr(image_bytes: bytes) -> str:
    if is_tesseract_available():
        image = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(image)

    if is_rapidocr_available():
        engine = get_rapidocr_engine()
        if not engine:
          return ""
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        result, _ = engine(np.array(image))
        if not result:
            return ""
        lines = []
        for item in result:
            if len(item) >= 2 and item[1]:
                lines.append(str(item[1]))
        return "\n".join(lines)

    return ""


def get_rapidocr_engine() -> RapidOCR | None:
    global _rapidocr_engine
    if _rapidocr_engine is None and RapidOCR is not None:
        _rapidocr_engine = RapidOCR()
    return _rapidocr_engine


def parse_timetable_text(raw_text: str) -> list[dict[str, str]]:
    candidates = list(iter_candidate_lines(raw_text))
    entries: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()

    for candidate in expand_candidate_windows(candidates):
        entry = parse_candidate(candidate)
        if not entry:
            continue

        key = (
            entry["subject_name"].lower(),
            entry["time"].lower(),
            entry["room_number"].lower(),
        )
        if key in seen:
            continue

        seen.add(key)
        entries.append(entry)

    return entries


def iter_candidate_lines(raw_text: str) -> Iterable[str]:
    normalized_lines = []
    for raw_line in raw_text.splitlines():
        line = normalize_spaces(raw_line)
        if len(line) < 3:
            continue
        normalized_lines.append(line)

        if "|" not in line and "  " in raw_line:
            columns = [normalize_spaces(part) for part in re.split(r"\s{2,}", raw_line) if normalize_spaces(part)]
            if len(columns) >= 2:
                normalized_lines.append(" | ".join(columns))

    return normalized_lines


def expand_candidate_windows(lines: list[str]) -> Iterable[str]:
    for index, line in enumerate(lines):
        yield line
        if index + 1 < len(lines):
            yield f"{line} | {lines[index + 1]}"
        if index + 2 < len(lines):
            yield f"{line} | {lines[index + 1]} | {lines[index + 2]}"


def parse_candidate(candidate: str) -> dict[str, str] | None:
    time_match = TIME_PATTERN.search(candidate)
    if not time_match:
        return None

    time_value = normalize_time(time_match.group("time"))
    room_value = extract_room(candidate)
    subject_value = extract_subject(candidate, time_match.group("time"), room_value)

    if not subject_value or not room_value:
        return None

    return {
        "subject_name": subject_value,
        "time": time_value,
        "room_number": room_value,
    }


def extract_room(line: str) -> str:
    label_match = ROOM_LABEL_PATTERN.search(line)
    if label_match:
        return normalize_spaces(label_match.group("room"))

    fallback_matches = ROOM_FALLBACK_PATTERN.findall(line)
    if fallback_matches:
        return normalize_spaces(fallback_matches[-1])

    columns = split_columns(line)
    if len(columns) >= 3:
        candidate = columns[-1]
        if looks_like_room(candidate):
            return candidate

    return ""


def extract_subject(line: str, time_value: str, room_value: str) -> str:
    subject = line.replace(time_value, " ")

    if room_value:
        subject = re.sub(
            rf"\b(?:room|rm|lab|hall|classroom|block|venue)\s*[:.-]?\s*{re.escape(room_value)}\b",
            " ",
            subject,
            flags=re.IGNORECASE,
        )
        subject = re.sub(rf"\b{re.escape(room_value)}\b", " ", subject)

    columns = split_columns(subject)
    if columns:
        preferred = next((column for column in columns if not TIME_PATTERN.search(column) and not looks_like_room(column)), columns[0])
        subject = preferred

    subject = NOISE_PATTERN.sub(" ", subject)
    subject = re.sub(r"^[\d.:\-–\s]+", " ", subject)
    subject = re.sub(r"\b(?:AM|PM)\b", " ", subject, flags=re.IGNORECASE)
    subject = SUBJECT_CLEANUP_PATTERN.sub(" ", subject).strip(" -|:")

    if len(subject) < 2 or looks_like_room(subject):
        return ""

    return subject


def split_columns(line: str) -> list[str]:
    if "|" in line:
        return [normalize_spaces(part) for part in line.split("|") if normalize_spaces(part)]
    return [normalize_spaces(line)] if normalize_spaces(line) else []


def looks_like_room(value: str) -> bool:
    compact = normalize_spaces(value)
    return bool(ROOM_FALLBACK_PATTERN.fullmatch(compact) or ROOM_LABEL_PATTERN.search(compact))


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_time(value: str) -> str:
    return normalize_spaces(value.replace(".", ":").replace("to", "-"))
